import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
const backendDir = path.join(projectRoot, "backend");

const results = [];
const children = [];

function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
}

function startService(script, port, extraEnv = {}) {
  const child = spawn(process.execPath, [path.join(backendDir, script)], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: String(port),
      CLIENT_ORIGIN: "https://meet-ai-anchoring.vercel.app",
      SARVAM_API_KEY: "",
      MONGO_URI: "",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.push(child);
  child.stdout.on("data", (chunk) =>
    process.stdout.write(`[${script}] ${chunk}`)
  );
  child.stderr.on("data", (chunk) =>
    process.stderr.write(`[${script}] ${chunk}`)
  );

  return child;
}

async function waitForHealth(port, expectedService) {
  const deadline = Date.now() + 25000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (!expectedService || payload.service === expectedService) {
          return payload;
        }
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(
    `Health check failed for port ${port}: ${lastError?.message || "timeout"}`
  );
}

function connectClient(port) {
  return io(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 5000,
    forceNew: true,
  });
}

function waitFor(socket, event, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeout);

    const handler = (payload) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

function waitForMatching(socket, event, predicate, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for matching "${event}"`));
    }, timeout);

    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

function connectAndWait(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Socket connect timed out")),
      8000
    );
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

async function testWebRTC() {
  const port = 4311;
  startService("webrtc-server.js", port);
  const health = await waitForHealth(port, "webrtc-signaling");
  check("WebRTC health endpoint", health.status === "ok", JSON.stringify(health));

  const a = connectClient(port);
  const b = connectClient(port);
  await Promise.all([connectAndWait(a), connectAndWait(b)]);

  const aJoined = waitForMatching(
    a,
    "participants-list",
    (list) => Array.isArray(list) && list.length === 1
  );
  a.emit("join-room", {
    roomId: "ROOM-A",
    userName: "Alice",
    userId: "user-alice",
    waitingRoom: false,
  });
  const aList = await aJoined;
  check(
    "join-room publishes participant",
    aList[0]?.id === a.id && aList[0]?.name === "Alice",
    JSON.stringify(aList)
  );

  const aUserJoined = waitFor(a, "user-joined");
  const bListPromise = waitForMatching(
    b,
    "participants-list",
    (list) => Array.isArray(list) && list.length === 2
  );
  b.emit("join-room", {
    roomId: "ROOM-A",
    userName: "Bob",
    userId: "user-bob",
    waitingRoom: false,
  });
  const bList = await bListPromise;
  const joined = await aUserJoined;
  check(
    "second participant appears in room list",
    bList.length === 2 && joined.id === b.id,
    `${bList.length} participants`
  );

  const offerPromise = waitFor(b, "offer");
  a.emit("offer", { targetId: b.id, offer: { type: "offer", sdp: "v=0" } });
  const offer = await offerPromise;
  check(
    "offer relay",
    offer.fromId === a.id && offer.offer?.sdp === "v=0",
    JSON.stringify(offer)
  );

  const answerPromise = waitFor(a, "answer");
  b.emit("answer", {
    targetId: a.id,
    answer: { type: "answer", sdp: "v=0" },
  });
  const answer = await answerPromise;
  check(
    "answer relay",
    answer.fromId === b.id && answer.answer?.type === "answer",
    JSON.stringify(answer)
  );

  const icePromise = waitFor(b, "ice-candidate");
  a.emit("ice-candidate", {
    targetId: b.id,
    candidate: { candidate: "candidate:1 1 UDP 1 127.0.0.1 9000 typ host" },
  });
  const ice = await icePromise;
  check(
    "ICE candidate relay",
    ice.fromId === a.id && Boolean(ice.candidate?.candidate),
    JSON.stringify(ice)
  );

  const mediaPromise = waitForMatching(
    b,
    "media-state-changed",
    (payload) => payload.userId === a.id
  );
  a.emit("media-state-change", {
    micOn: false,
    camOn: true,
    isScreenSharing: false,
  });
  const media = await mediaPromise;
  check(
    "media state broadcast",
    media.micOn === false && media.camOn === true,
    JSON.stringify(media)
  );

  const aChat = waitFor(a, "chat-message");
  const bChat = waitFor(b, "chat-message");
  b.emit("chat-message", { message: "hello room" });
  const [chatA, chatB] = await Promise.all([aChat, bChat]);
  check(
    "chat broadcast to sender and peers",
    chatA.message === "hello room" && chatB.message === "hello room",
    chatA.message
  );

  const aQuestion = waitFor(a, "new-question");
  const bQuestion = waitFor(b, "new-question");
  a.emit("submit-question", { question: "What is the agenda?" });
  const [questionA, questionB] = await Promise.all([aQuestion, bQuestion]);
  check(
    "Q&A question broadcast",
    questionA.id === questionB.id &&
      questionB.question === "What is the agenda?",
    questionB.question
  );

  const answerUpdateA = waitFor(a, "question-updated");
  const answerUpdateB = waitFor(b, "question-updated");
  b.emit("answer-question", {
    questionId: questionA.id,
    answer: "The agenda is in the invite.",
  });
  const [answeredA, answeredB] = await Promise.all([
    answerUpdateA,
    answerUpdateB,
  ]);
  check(
    "Q&A answer broadcast",
    answeredA.answered &&
      answeredB.answer === "The agenda is in the invite.",
    answeredB.answer
  );

  const handPromise = waitFor(b, "hand-raise");
  a.emit("hand-raise", { raised: true });
  const hand = await handPromise;
  check(
    "hand raise broadcast",
    hand.userId === a.id && hand.raised === true,
    JSON.stringify(hand)
  );

  // Waiting room with a fresh room.
  const host = connectClient(port);
  const guest = connectClient(port);
  await Promise.all([connectAndWait(host), connectAndWait(guest)]);

  const hostSettings = waitFor(host, "room-settings");
  host.emit("join-room", {
    roomId: "ROOM-WAIT",
    userName: "Host",
    userId: "host",
    waitingRoom: true,
  });
  const settings = await hostSettings;
  check("host receives room settings", settings.isHost === true);

  const waitingNotice = waitFor(guest, "waiting-for-admission");
  const waitingList = waitForMatching(
    host,
    "waiting-participants",
    (list) => Array.isArray(list) && list.some((item) => item.id === guest.id)
  );
  guest.emit("join-room", {
    roomId: "ROOM-WAIT",
    userName: "Guest",
    userId: "guest",
    waitingRoom: true,
  });
  await waitingNotice;
  const queued = await waitingList;
  check(
    "waiting room holds guest and notifies host",
    queued.some((item) => item.id === guest.id),
    JSON.stringify(queued)
  );

  const admitted = waitFor(guest, "admitted");
  const guestList = waitForMatching(
    guest,
    "participants-list",
    (list) => Array.isArray(list) && list.length === 2
  );
  host.emit("admit-participant", { targetId: guest.id });
  await admitted;
  const admittedList = await guestList;
  check(
    "host can admit waiting participant",
    admittedList.length === 2,
    `${admittedList.length} participants`
  );

  [a, b, host, guest].forEach((socket) => socket.disconnect());
}

async function testAnchoring() {
  const port = 4312;
  startService("anchoring-service.js", port, { SARVAM_API_KEY: "" });
  const health = await waitForHealth(port, "anchoring");
  check("Anchoring health endpoint", health.status === "ok", JSON.stringify(health));

  const creator = connectClient(port);
  await connectAndWait(creator);
  creator.emit("join-anchoring-room", {
    roomId: "ROOM-ANCHOR",
    userId: "creator",
    language: "en",
  });

  const enabled = waitFor(creator, "anchoring-enabled");
  creator.emit("enable-anchoring", {
    roomId: "ROOM-ANCHOR",
    creatorId: "creator",
    settings: {
      meetingTitle: "Verification Meeting",
      language: "en-US",
      schedule: [
        { speakerName: "Alice", topic: "Intro", duration: 1, userId: "a" },
        { speakerName: "Bob", topic: "Demo", duration: 1, userId: "b" },
      ],
    },
  });
  const enabledPayload = await enabled;
  check(
    "enable-anchoring creates schedule",
    enabledPayload.schedule?.length === 2,
    JSON.stringify(enabledPayload.schedule)
  );

  const started = waitFor(creator, "anchoring-started");
  const tts = waitForMatching(
    creator,
    "anchor-tts",
    (payload) => Boolean(payload.script)
  );
  const announcement = waitFor(creator, "anchor-announcement");
  const firstSpeaker = waitFor(creator, "speaker-changed");
  creator.emit("start-anchoring", { roomId: "ROOM-ANCHOR" });
  await started;
  const firstTts = await tts;
  const firstAnnouncement = await announcement;
  const speaker = await firstSpeaker;
  check(
    "start-anchoring speaks intro and schedules first speaker",
    speaker.currentSpeaker?.speakerName === "Alice" &&
      Boolean(firstTts.script) &&
      Boolean(firstAnnouncement.script),
    `${speaker.currentSpeaker?.speakerName} / audio=${Boolean(firstTts.audio)}`
  );

  const timeUpdate = waitFor(creator, "time-update", 5000);
  const timerPayload = await timeUpdate;
  check(
    "countdown time-update is emitted",
    Number.isFinite(timerPayload.timeRemaining),
    JSON.stringify(timerPayload.timeRemaining)
  );

  const paused = waitFor(creator, "anchoring-paused");
  creator.emit("pause-anchoring", { roomId: "ROOM-ANCHOR" });
  await paused;
  const pausedStatus = await new Promise((resolve) =>
    creator.emit("get-anchoring-status", { roomId: "ROOM-ANCHOR" }, resolve)
  );
  check("pause-anchoring stops the timer", pausedStatus.isActive === false);

  const resumed = waitFor(creator, "anchoring-resumed");
  creator.emit("resume-anchoring", { roomId: "ROOM-ANCHOR" });
  await resumed;
  const resumedStatus = await new Promise((resolve) =>
    creator.emit("get-anchoring-status", { roomId: "ROOM-ANCHOR" }, resolve)
  );
  check("resume-anchoring restarts the timer", resumedStatus.isActive === true);

  const scheduleUpdated = waitFor(creator, "anchoring-schedule-updated");
  creator.emit("update-schedule", {
    roomId: "ROOM-ANCHOR",
    schedule: [
      { speakerName: "Alice", topic: "Intro", duration: 1, userId: "a" },
      { speakerName: "Bob", topic: "Demo", duration: 1, userId: "b" },
      { speakerName: "Cara", topic: "Wrap", duration: 1, userId: "c" },
    ],
  });
  const updated = await scheduleUpdated;
  check(
    "update-schedule updates the session",
    updated.schedule?.length === 3,
    JSON.stringify(updated.schedule?.length)
  );

  const skipped = waitFor(creator, "speaker-changed");
  creator.emit("skip-speaker", { roomId: "ROOM-ANCHOR" });
  const skippedPayload = await skipped;
  check(
    "skip-speaker advances to next speaker",
    skippedPayload.currentIndex === 1 &&
      skippedPayload.currentSpeaker?.speakerName === "Bob",
    JSON.stringify(skippedPayload.currentIndex)
  );

  const restarted = waitFor(creator, "anchoring-restarted");
  const restartSpeaker = waitFor(creator, "speaker-changed");
  creator.emit("restart-anchoring", { roomId: "ROOM-ANCHOR" });
  await restarted;
  const restartPayload = await restartSpeaker;
  check(
    "restart-anchoring starts again from speaker 1",
    restartPayload.currentIndex === 0,
    JSON.stringify(restartPayload.currentIndex)
  );

  const ended = waitFor(creator, "anchoring-ended", 10000);
  creator.emit("stop-anchoring", { roomId: "ROOM-ANCHOR" });
  await ended;
  const stoppedStatus = await new Promise((resolve) =>
    creator.emit("get-anchoring-status", { roomId: "ROOM-ANCHOR" }, resolve)
  );
  check(
    "stop-anchoring ends the active session but keeps it restartable",
    stoppedStatus.isActive === false && stoppedStatus.isAnchoringEnabled === true,
    JSON.stringify(stoppedStatus)
  );

  const reset = waitFor(creator, "anchoring-reset");
  creator.emit("reset-anchoring", { roomId: "ROOM-ANCHOR" });
  await reset;
  check("reset-anchoring emits confirmation", true);

  creator.disconnect();
}

async function testTranslation() {
  const port = 4313;
  startService("translation.js", port, {
    SARVAM_API_KEY: "",
    MONGO_URI: "",
  });
  const health = await waitForHealth(port, "translation");
  check(
    "Translation health endpoint works without MongoDB",
    health.status === "ok" && health.database === "unavailable",
    JSON.stringify(health)
  );

  const speaker = connectClient(port);
  const listener = connectClient(port);
  await Promise.all([connectAndWait(speaker), connectAndWait(listener)]);

  const speakerJoined = waitFor(speaker, "translation-joined");
  const listenerJoined = waitFor(listener, "translation-joined");
  speaker.emit("join-translation", {
    userId: "speaker-1",
    userName: "Speaker",
    roomId: "ROOM-TRANSLATE",
    preferredLanguage: "en",
  });
  listener.emit("join-translation", {
    userId: "listener-1",
    userName: "Listener",
    roomId: "ROOM-TRANSLATE",
    preferredLanguage: "en",
  });
  await Promise.all([speakerJoined, listenerJoined]);

  let speakerReceivedCaption = false;
  speaker.on("translated-caption", () => {
    speakerReceivedCaption = true;
  });

  const caption = waitFor(listener, "translated-caption");
  const audio = waitFor(listener, "tts-audio");
  speaker.emit("speech-text", {
    userId: "speaker-1",
    text: "hello from the speaker",
    originalLanguage: "en",
    isInterim: false,
  });

  const [captionPayload, audioPayload] = await Promise.all([caption, audio]);
  check(
    "translated-caption delivered to the other participant",
    captionPayload.translatedText === "hello from the speaker" &&
      captionPayload.speaker === "Speaker",
    JSON.stringify(captionPayload.translatedText)
  );
  check(
    "tts-audio fallback delivered with translated text",
    audioPayload.audio === null &&
      audioPayload.translatedText === "hello from the speaker",
    JSON.stringify(audioPayload.translatedText)
  );
  check(
    "speaker does not receive their own caption",
    speakerReceivedCaption === false
  );

  const languages = waitFor(listener, "available-languages");
  listener.emit("get-languages");
  const languagePayload = await languages;
  check(
    "available languages preserved",
    languagePayload.en === "English" && languagePayload.ml === "Malayalam",
    `${Object.keys(languagePayload).length} languages`
  );

  speaker.disconnect();
  listener.disconnect();
}

async function main() {
  try {
    await testWebRTC();
    await testAnchoring();
    await testTranslation();
  } catch (error) {
    console.error("TEST RUN FAILED:", error);
    results.push({ name: "test run", ok: false, detail: error.message });
  } finally {
    children.forEach((child) => {
      if (!child.killed) child.kill();
    });

    const failed = results.filter((result) => !result.ok);
    console.log(
      `\n${results.length - failed.length}/${results.length} checks passed`
    );
    if (failed.length > 0) {
      failed.forEach((result) =>
        console.log(`FAILED: ${result.name} - ${result.detail}`)
      );
      process.exitCode = 1;
    }
  }
}

main();
