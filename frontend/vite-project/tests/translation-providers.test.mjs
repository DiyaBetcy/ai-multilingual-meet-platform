import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";
import assert from "node:assert/strict";
import { test } from "node:test";

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

async function withService(port, extraEnv, run) {
  const child = spawn(process.execPath, [path.join(backendDir, "translation.js")], {
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

  child.stdout.on("data", (chunk) =>
    process.stdout.write(`[providers:${port}] ${chunk}`)
  );
  child.stderr.on("data", (chunk) =>
    process.stderr.write(`[providers:${port}] ${chunk}`)
  );

  try {
    const deadline = Date.now() + 30000;

    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        if (response.ok) break;
      } catch {
        // retry
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    await run();
  } finally {
    if (!child.killed) child.kill();
  }
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

function waitFor(predicate, timeout = 12000, label = "condition") {
  const deadline = Date.now() + timeout;
  return (async () => {
    while (Date.now() < deadline) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for ${label}`);
  })();
}

async function preparePair(port) {
  const sockets = [];

  const makeUser = async (userId, userName, language) => {
    const socket = connectClient(port);
    await connectAndWait(socket);
    const captions = [];
    const audio = [];
    socket.on("translated-caption", (payload) => captions.push(payload));
    socket.on("tts-audio", (payload) => audio.push(payload));
    socket.emit("join-translation", {
      userId,
      userName,
      roomId: `ROOM-${port}`,
      preferredLanguage: language,
    });
    sockets.push(socket);
    return { socket, captions, audio };
  };

  const speaker = await makeUser("provider-speaker", "Speaker", "en");
  const listener = await makeUser("provider-listener", "Listener", "hi");
  await new Promise((resolve) => setTimeout(resolve, 200));

  return {
    speaker,
    listener,
    cleanup: () => sockets.forEach((socket) => socket.disconnect()),
  };
}

test("Sarvam is the primary translation provider", async () => {
  await withService(
    4411,
    {
      MOCK_MYMEMORY_FAIL: "1",
      MOCK_GOOGLE_FAIL: "1",
    },
    async () => {
      const { speaker, listener, cleanup } = await preparePair(4411);

      try {
        speaker.socket.emit("speech-text", {
          userId: "provider-speaker",
          text: "primary provider check",
          originalLanguage: "en",
        });

        await waitFor(
          () => listener.captions.length === 1,
          12000,
          "Sarvam caption"
        );

        assert.equal(listener.captions[0].translatedText, "[hi] primary provider check");
        assert.equal(listener.captions[0].translationError, "");
      } finally {
        cleanup();
      }
    }
  );
});

test("MyMemory is used when Sarvam translation fails", async () => {
  await withService(
    4412,
    {
      MOCK_SARVAM_TRANSLATE_FAIL: "1",
    },
    async () => {
      const { speaker, listener, cleanup } = await preparePair(4412);

      try {
        speaker.socket.emit("speech-text", {
          userId: "provider-speaker",
          text: "fallback provider check",
          originalLanguage: "en",
        });

        await waitFor(
          () => listener.captions.length === 1,
          12000,
          "MyMemory caption"
        );

        assert.equal(listener.captions[0].translatedText, "[hi] fallback provider check");
        assert.equal(listener.captions[0].translationError, "");
      } finally {
        cleanup();
      }
    }
  );
});

test("TTS failure falls back to translated text for browser speech", async () => {
  await withService(
    4413,
    {
      MOCK_TTS_FAIL: "1",
    },
    async () => {
      const { speaker, listener, cleanup } = await preparePair(4413);

      try {
        speaker.socket.emit("speech-text", {
          userId: "provider-speaker",
          text: "browser speech check",
          originalLanguage: "en",
        });

        await waitFor(
          () => listener.audio.length === 1,
          12000,
          "browser fallback payload"
        );

        const payload = listener.audio[0];
        assert.equal(payload.audio, null);
        assert.equal(payload.language, "hi");
        assert.equal(payload.translatedText, "[hi] browser speech check");
        assert.ok(payload.ttsError, "the TTS failure reason should be reported");
        assert.equal(payload.translationError || "", "");
      } finally {
        cleanup();
      }
    }
  );
});
