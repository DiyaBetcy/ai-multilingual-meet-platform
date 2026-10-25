import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";
import assert from "node:assert/strict";
import { test, before, after } from "node:test";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const backendDir = path.join(projectRoot, "backend");
const mockPreload = path
  .join(backendDir, "tests", "mock-services.cjs")
  .replace(/\\/g, "/");

const TRANSLATION_PORT = 4401;
const ANCHORING_PORT = 4402;

const children = [];

function startService(script, port, extraEnv = {}) {
  const child = spawn(process.execPath, [path.join(backendDir, script)], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: String(port),
      CLIENT_ORIGIN: "http://localhost:5173",
      SARVAM_API_KEY: "test-key",
      MONGO_URI: "",
      JWT_SECRET: "test-secret",
      NODE_OPTIONS: `--require "${mockPreload}"`,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.push(child);
  child.stdout.on("data", (chunk) => process.stdout.write(`[${script}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${script}] ${chunk}`));
  return child;
}

async function waitForHealth(port, expectedService) {
  const deadline = Date.now() + 30000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        const payload = await response.json();
        if (!expectedService || payload.service === expectedService) {
          return payload;
        }
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Health check failed on ${port}: ${lastError?.message || "timeout"}`
  );
}

function connectClient(port) {
  return io(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    timeout: 8000,
  });
}

function connectAndWait(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Socket connect timeout")), 8000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/* Collect every caption/audio event so assertions can prove which socket
 * received what, and in which order. */
function collector(socket) {
  const captions = [];
  const audio = [];
  socket.on("translated-caption", (payload) => captions.push(payload));
  socket.on("tts-audio", (payload) => audio.push(payload));
  return { captions, audio };
}

async function waitFor(predicate, timeout = 12000, label = "condition") {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function joinTranslation(socket, { userId, userName, roomId, language }) {
  const joined = new Promise((resolve) => socket.once("translation-joined", resolve));
  socket.emit("join-translation", {
    userId,
    userName,
    roomId,
    preferredLanguage: language,
  });
  return joined;
}

test("translation pipeline", async (t) => {
  startService("translation.js", TRANSLATION_PORT);
  await waitForHealth(TRANSLATION_PORT, "translation");

  const room = "ROOM-BIDIRECTIONAL";
  const sockets = [];
  const makeUser = async (userId, name, language) => {
    const socket = connectClient(TRANSLATION_PORT);
    await connectAndWait(socket);
    const events = collector(socket);
    const joined = await joinTranslation(socket, {
      userId,
      userName: name,
      roomId: room,
      language,
    });
    sockets.push(socket);
    return { socket, events, joined };
  };

  const A = await makeUser("user-a", "Alice", "en");
  const B = await makeUser("user-b", "Bob", "hi");
  const C = await makeUser("user-c", "Cara", "ml");

  t.after(() => sockets.forEach((socket) => socket.disconnect()));

  await t.test("each participant keeps their own registered language", () => {
    assert.equal(A.joined.language, "en");
    assert.equal(B.joined.language, "hi");
    assert.equal(C.joined.language, "ml");
  });

  await t.test("A speaking English reaches B in Hindi and C in Malayalam", async () => {
    A.socket.emit("speech-text", {
      userId: "user-a",
      text: "good morning team",
      originalLanguage: "en",
      isInterim: false,
    });

    await waitFor(() => B.events.captions.length === 1 && C.events.captions.length === 1, 12000, "b/c captions");

    const captionB = B.events.captions[0];
    const captionC = C.events.captions[0];

    assert.equal(captionB.sourceLanguage, "en");
    assert.equal(captionB.targetLanguage, "hi");
    assert.equal(captionB.translatedText, "[hi] good morning team");
    assert.equal(captionB.text, "good morning team");

    assert.equal(captionC.targetLanguage, "ml");
    assert.equal(captionC.translatedText, "[ml] good morning team");

    assert.equal(A.events.captions.length, 0, "speaker must not receive their own caption");
    assert.equal(A.events.audio.length, 0, "speaker must not receive their own audio");

    await waitFor(() => B.events.audio.length === 1 && C.events.audio.length === 1, 12000, "b/c audio");
    const audioB = B.events.audio[0];
    const audioC = C.events.audio[0];

    assert.equal(audioB.language, "hi");
    assert.equal(audioC.language, "ml");
    assert.equal(audioB.messageId, captionB.messageId);
    assert.equal(audioC.messageId, captionC.messageId);
    assert.ok(audioB.audio, "Sarvam TTS audio should be present (mocked)");
    assert.ok(audioC.audio, "Sarvam TTS audio should be present (mocked)");
  });

  await t.test("B speaking Hindi reaches A in English and C in Malayalam", async () => {
    B.socket.emit("speech-text", {
      userId: "user-b",
      text: "namaste everyone",
      originalLanguage: "hi",
      isInterim: false,
    });

    await waitFor(() => A.events.captions.length === 1 && C.events.captions.length === 2, 12000, "a/c captions");

    const captionA = A.events.captions[0];
    const captionC = C.events.captions[1];

    assert.equal(captionA.sourceLanguage, "hi");
    assert.equal(captionA.targetLanguage, "en");
    assert.equal(captionA.translatedText, "[en] namaste everyone");
    assert.equal(captionC.targetLanguage, "ml");
    assert.equal(captionC.translatedText, "[ml] namaste everyone");
    assert.equal(B.events.captions.length, 1, "B only received A's earlier caption");
  });

  await t.test("source language comes from the speaker's spoken language, not their listener preference", async () => {
    const beforeA = A.events.captions.length;
    const beforeB = B.events.captions.length;
    const beforeC = C.events.captions.length;

    /* A wants English (target) but is speaking Hindi (source). The
       backend must translate from the source language carried by the
       speech event, never from A's recipient preference. */
    A.socket.emit("speech-text", {
      userId: "user-a",
      text: "source check",
      originalLanguage: "hi",
    });

    await waitFor(
      () => B.events.captions.length > beforeB && C.events.captions.length > beforeC,
      12000,
      "source separation captions"
    );

    const captionB = B.events.captions[beforeB];
    const captionC = C.events.captions[beforeC];

    // B's target equals the spoken language: original text, no fake translation.
    assert.equal(captionB.sourceLanguage, "hi");
    assert.equal(captionB.targetLanguage, "hi");
    assert.equal(captionB.translatedText, "source check");
    assert.equal(captionB.isOriginal, true);

    // C still gets Malayalam, translated from the spoken Hindi.
    assert.equal(captionC.sourceLanguage, "hi");
    assert.equal(captionC.targetLanguage, "ml");
    assert.equal(captionC.translatedText, "[ml] source check");

    assert.equal(A.events.captions.length, beforeA, "speaker still receives nothing");
  });

  await t.test("changing A's language does not change B's or C's preference", async () => {
    const changedPromise = new Promise((resolve) =>
      A.socket.once("language-changed", resolve)
    );
    A.socket.emit("change-language", { userId: "user-a", newLanguage: "ta" });
    const changed = await changedPromise;
    assert.equal(changed.language, "ta");

    const beforeA = A.events.captions.length;
    const beforeB = B.events.captions.length;

    C.socket.emit("speech-text", {
      userId: "user-c",
      text: "vanakkam",
      originalLanguage: "ml",
    });

    await waitFor(
      () => A.events.captions.length > beforeA && B.events.captions.length > beforeB,
      12000,
      "a/b captions after change"
    );

    const captionA = A.events.captions[beforeA];
    const captionB = B.events.captions[beforeB];

    assert.equal(captionA.targetLanguage, "ta", "A now receives Tamil");
    assert.equal(captionA.translatedText, "[ta] vanakkam");
    assert.equal(captionB.targetLanguage, "hi", "B still receives Hindi");
    assert.equal(captionB.translatedText, "[hi] vanakkam");
  });

  await t.test("same-language recipient receives the original text, not a fake translation", async () => {
    const changedPromise = new Promise((resolve) =>
      A.socket.once("language-changed", resolve)
    );
    A.socket.emit("change-language", { userId: "user-a", newLanguage: "en" });
    await changedPromise;

    const before = A.events.captions.length;
    C.socket.emit("speech-text", {
      userId: "user-c",
      text: "original english line",
      originalLanguage: "en",
    });

    await waitFor(() => A.events.captions.length > before, 12000, "same-language caption");
    const caption = A.events.captions[A.events.captions.length - 1];

    assert.equal(caption.targetLanguage, "en");
    assert.equal(caption.sourceLanguage, "en");
    assert.equal(caption.isOriginal, true);
    assert.equal(caption.translatedText, "original english line");
  });

  await t.test("translation failure does not emit audio or original-language fallback", async () => {
    const beforeB = B.events.captions.length;
    const beforeAudioB = B.events.audio.length;

    A.socket.emit("speech-text", {
      userId: "user-a",
      text: "FAILME this cannot be translated",
      originalLanguage: "en",
    });

    await waitFor(() => B.events.captions.length > beforeB, 12000, "failure caption");
    const caption = B.events.captions[B.events.captions.length - 1];

    assert.equal(caption.translationError, "Translation is temporarily unavailable.");
    assert.equal(caption.translatedText, "");
    assert.equal(caption.targetLanguage, "hi");
    // No translated audio may be produced from the original text.
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(B.events.audio.length, beforeAudioB);
  });

  await t.test("duplicate final transcript is dropped", async () => {
    const before = B.events.captions.length;
    const payload = {
      userId: "user-a",
      text: "repeat me once",
      originalLanguage: "en",
    };
    A.socket.emit("speech-text", payload);
    A.socket.emit("speech-text", payload);
    await waitFor(() => B.events.captions.length > before, 12000, "first duplicate");
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(B.events.captions.length, before + 1);
  });

  await t.test("messages from one speaker stay ordered with matching ids", async () => {
    const before = B.events.captions.length;
    const beforeAudio = B.events.audio.length;
    A.socket.emit("speech-text", { userId: "user-a", text: "first line", originalLanguage: "en" });
    A.socket.emit("speech-text", { userId: "user-a", text: "second line", originalLanguage: "en" });
    A.socket.emit("speech-text", { userId: "user-a", text: "third line", originalLanguage: "en" });

    await waitFor(() => B.events.captions.length >= before + 3, 15000, "ordered captions");
    const lines = B.events.captions.slice(before, before + 3).map((item) => item.text);
    assert.deepEqual(lines, ["first line", "second line", "third line"]);

    const ids = B.events.captions.slice(before, before + 3).map((item) => item.messageId);
    assert.equal(new Set(ids).size, 3, "message ids must be unique");

    await waitFor(() => B.events.audio.length >= beforeAudio + 3, 35000, "ordered audio");
    const audioIds = B.events.audio.slice(-3).map((item) => item.messageId);
    assert.deepEqual(audioIds, ids, "audio order must match caption order");
  });

  await t.test("reconnect keeps the reconnecting user's preference and others untouched", async () => {
    B.socket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const reconnect = connectClient(TRANSLATION_PORT);
    await connectAndWait(reconnect);
    const events = collector(reconnect);
    await joinTranslation(reconnect, {
      userId: "user-b",
      userName: "Bob",
      roomId: room,
      language: "hi",
    });
    sockets.push(reconnect);

    const beforeA = A.events.captions.length;
    const beforeC = C.events.captions.length;
    reconnect.emit("speech-text", {
      userId: "user-b",
      text: "welcome back",
      originalLanguage: "hi",
    });

    await waitFor(() => A.events.captions.length > beforeA && C.events.captions.length > beforeC, 12000, "reconnect routing");
    assert.equal(A.events.captions[A.events.captions.length - 1].translatedText, "[en] welcome back");
    assert.equal(C.events.captions[C.events.captions.length - 1].translatedText, "[ml] welcome back");
    assert.equal(events.captions.length, 0, "reconnected speaker must not receive their own caption");
  });

  await t.test("stale socket cannot change another user's language", async () => {
    const intruder = connectClient(TRANSLATION_PORT);
    await connectAndWait(intruder);
    intruder.emit("change-language", { userId: "user-a", newLanguage: "ur" });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const before = A.events.captions.length;
    C.socket.emit("speech-text", {
      userId: "user-c",
      text: "still english please",
      originalLanguage: "ml",
    });
    await waitFor(() => A.events.captions.length > before, 12000, "post-intruder caption");
    assert.equal(
      A.events.captions[A.events.captions.length - 1].targetLanguage,
      "en",
      "A's preference must not be hijacked by another socket"
    );
    intruder.disconnect();
  });
});

test("AI anchoring announcements use each recipient's language", async (t) => {
  startService("anchoring-service.js", ANCHORING_PORT);
  await waitForHealth(ANCHORING_PORT, "anchoring");

  const room = "ROOM-ANCHOR-LANG";
  const sockets = [];

  const makeClient = async (userId, language) => {
    const socket = connectClient(ANCHORING_PORT);
    await connectAndWait(socket);
    const tts = [];
    socket.on("anchor-tts", (payload) => tts.push(payload));
    socket.emit("join-anchoring-room", {
      roomId: room,
      userId,
      userName: userId,
      language,
    });
    sockets.push(socket);
    return { socket, tts };
  };

  const creator = await makeClient("creator", "en");
  const hindi = await makeClient("hindi-user", "hi");
  const malayalam = await makeClient("malayalam-user", "ml");

  t.after(() => sockets.forEach((socket) => socket.disconnect()));
  await new Promise((resolve) => setTimeout(resolve, 250));

  const enabled = new Promise((resolve) => creator.socket.once("anchoring-enabled", resolve));
  creator.socket.emit("enable-anchoring", {
    roomId: room,
    creatorId: "creator",
    settings: {
      meetingTitle: "Language Test",
      language: "en-US",
      schedule: [{ speakerName: "Alice", topic: "Intro", duration: 1, userId: "a" }],
    },
  });
  await enabled;

  creator.socket.emit("start-anchoring", { roomId: room });
  await waitFor(
    () => creator.tts.length >= 1 && hindi.tts.length >= 1 && malayalam.tts.length >= 1,
    15000,
    "anchor TTS per user"
  );

  assert.equal(creator.tts[0].language, "en-US");
  assert.equal(hindi.tts[0].language, "hi-IN");
  assert.equal(malayalam.tts[0].language, "ml-IN");
  assert.match(hindi.tts[0].script, /^\[hi\]/);
  assert.match(malayalam.tts[0].script, /^\[ml\]/);
  assert.ok(!/^\[hi\]/.test(creator.tts[0].script));

  await t.test("changing one recipient's language does not affect the others", async () => {
    hindi.socket.emit("update-anchor-language", {
      roomId: room,
      userId: "hindi-user",
      language: "ta",
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const beforeCreator = creator.tts.length;
    const beforeHindi = hindi.tts.length;
    const beforeMalayalam = malayalam.tts.length;

    hindi.socket.emit("skip-speaker", { roomId: room });
    await waitFor(
      () =>
        creator.tts.length > beforeCreator &&
        hindi.tts.length > beforeHindi &&
        malayalam.tts.length > beforeMalayalam,
      15000,
      "anchor TTS after language change"
    );

    assert.equal(hindi.tts[hindi.tts.length - 1].language, "ta-IN");
    assert.equal(malayalam.tts[malayalam.tts.length - 1].language, "ml-IN");
    assert.equal(creator.tts[creator.tts.length - 1].language, "en-US");
  });

  creator.socket.emit("stop-anchoring", { roomId: room });
});

after(() => {
  children.forEach((child) => {
    if (!child.killed) child.kill();
  });
});
