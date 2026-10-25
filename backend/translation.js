require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { SarvamAIClient } = require("sarvamai");
const cors = require("cors");
const mongoose = require("mongoose");
const {
  createTranslator,
  languageNames,
  normalizeLangCode,
  synthesizeSpeech,
} = require("./lib/multilingual");
const { connectMongo, describeMongoError } = require("./config/database");

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN)
  ? (process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN)
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : "*";

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "OPTIONS"],
  credentials: false
}));

app.use(express.json());

/* Email/OTP signup, password login, JWT session checks. Mounted here so
   the deployed translation/API service exposes the auth endpoints the
   frontend already calls. */
app.use(require("./auth"));

const sarvamApiKey = process.env.SARVAM_API_KEY;
const client = sarvamApiKey
  ? new SarvamAIClient({ apiSubscriptionKey: sarvamApiKey })
  : null;

if (!client) {
  console.warn(
    "SARVAM_API_KEY is not configured; translated captions will still work, but translated speech (TTS) is disabled. Using browser TTS fallback on client."
  );
}

// Transcript and Summary Models
const transcriptSchema = new mongoose.Schema(
  {
    meetingId: { type: String, required: true, index: true },
    speakerId: { type: String, required: true },
    speakerName: { type: String },
    originalText: { type: String, required: true },
    sourceLanguage: { type: String },
    translations: [
      {
        recipientId: { type: String },
        targetLanguage: { type: String },
        translatedText: { type: String },
        translationError: { type: String },
      },
    ],
    timestamp: { type: Date, default: Date.now },
    messageId: { type: String, index: true },
  },
  { collection: "transcripts" }
);

const summarySchema = new mongoose.Schema(
  {
    meetingId: { type: String, required: true, unique: true },
    summary: {
      overview: String,
      keyPoints: [String],
      decisions: [String],
      actionItems: [String],
      conclusions: String,
    },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: String },
    transcriptCount: { type: Number },
  },
  { collection: "meeting_summaries" }
);

const Transcript = mongoose.models.Transcript || mongoose.model("Transcript", transcriptSchema);
const MeetingSummary = mongoose.models.MeetingSummary || mongoose.model("MeetingSummary", summarySchema);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  },
});

const isDatabaseReady = () => mongoose.connection.readyState === 1;
let databaseWarningLogged = false;

/* Captions, translation and TTS do not depend on MongoDB. A missing or
   temporarily unavailable database must not terminate the service (that
   would also take speech translation offline). Auth and transcript/
   summary persistence report their own 503/unavailable state instead. */
(async () => {
  try {
    await connectMongo();
    console.log("Translation service MongoDB connected");
  } catch (error) {
    console.error(
      "Translation service MongoDB initialization failed:",
      describeMongoError(error),
      "Translation, captions and TTS will continue; auth, transcript storage and summaries stay unavailable until MongoDB is reachable."
    );
  }
})();

/* Connection registry. Keying by socket id (not userId) keeps two tabs
   of the same account, or a stale socket during a reconnect, from
   overwriting each other's language and room. */
const translationUsers = new Map();

const translator = createTranslator({ sarvamClient: client });

/* Recognition engines often re-emit the same final phrase after a
   restart. Drop only an exact repeat inside this short window; do not
   throw away different phrases just because they arrived quickly. */
const lastTranscriptBySocket = new Map();
const DUPLICATE_TRANSCRIPT_WINDOW_MS = 8000;

/* One queue per speaker preserves caption order when a provider call is
   slower than the next transcript segment. */
const translationQueues = new Map();


const processSpeechText = async ({ speaker, text, sourceLang }) => {
  const currentSpeaker = translationUsers.get(speaker.socketId);

  if (
    !currentSpeaker ||
    currentSpeaker.roomId !== speaker.roomId ||
    currentSpeaker.userId !== speaker.userId
  ) {
    console.log("Skipping queued transcript for a user who left:", speaker.userId);
    return;
  }

  const cleanText = text.trim();
  const roomUsers = Array.from(translationUsers.values()).filter(
    (user) =>
      user.roomId === currentSpeaker.roomId &&
      user.socketId !== currentSpeaker.socketId &&
      user.userId !== currentSpeaker.userId
  );

  console.log(
    `👥 Receivers in room ${currentSpeaker.roomId}:`,
    roomUsers.map((user) => `${user.name}:${user.language}`).join(", ") ||
      "none"
  );

  if (roomUsers.length === 0) {
    console.log("ℹ️ No other participants to receive translation");
    return;
  }

  const messageId = `${currentSpeaker.userId}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const translationTasks = roomUsers.map(async (targetUser) => {
    const targetLang = normalizeLangCode(targetUser.language || "en");

    try {
      let translatedText = cleanText;

      if (targetLang !== sourceLang) {
        translatedText = await translator.translate(
          cleanText,
          sourceLang,
          targetLang
        );

        console.log(
          `🔄 Translated for ${targetUser.name}: ${sourceLang} → ${targetLang}: ${translatedText}`
        );
      } else {
        console.log(
          `ℹ️ Same language for ${targetUser.name}, using original text`
        );
      }

      let audio = null;
      let ttsError = "";

      if (translatedText) {
        console.log(
          `🎤 Generating TTS for ${targetUser.name} in ${targetLang}: ${translatedText}`
        );

        const tts = await synthesizeSpeech({
          sarvamClient: client,
          text: translatedText,
          language: targetLang,
        });

        audio = tts.audio;
        ttsError = tts.error;

        if (audio) {
          console.log(
            `🔊 TTS ready for ${targetUser.name}, length: ${audio.length}`
          );
        } else {
          console.error(
            `❌ TTS unavailable for ${targetUser.name}: ${ttsError}`
          );
        }
      }

      return {
        targetUser,
        translatedText,
        targetLang,
        audio,
        ttsError,
        translationError: "",
      };
    } catch (error) {
      console.error(
        `❌ Translation failed for ${targetUser.name}:`,
        error.message
      );

      return {
        targetUser,
        // Never pretend the original text is the translation. The
        // frontend receives the original separately and labels the
        // caption as untranslated when this is set.
        translatedText: "",
        translationError: "Translation is temporarily unavailable.",
        targetLang,
        audio: null,
        ttsError: "",
      };
    }
  });

  const results = await Promise.all(translationTasks);

  results.forEach(
    ({ targetUser, translatedText, targetLang, audio, ttsError, translationError }) => {
      const targetSocket = io.sockets.sockets.get(targetUser.socketId);

      console.log("[TRANSLATE] Sending to recipient:", targetUser.name, targetLang, "hasAudio:", !!audio);
      if (!targetSocket) return;

      targetSocket.emit("translated-caption", {
        speaker: currentSpeaker.name,
        speakerId: currentSpeaker.userId,
        text: cleanText,
        translatedText,
        translationError,
        targetLanguage: targetLang,
        sourceLanguage: sourceLang,
        isOriginal: !translationError && targetLang === sourceLang,
        isInterim: false,
        messageId,
        timestamp: Date.now(),
      });

      // Store transcript in database when persistence is available.
      if (isDatabaseReady()) {
        Transcript.findOneAndUpdate(
          { meetingId: currentSpeaker.roomId, messageId },
          {
            meetingId: currentSpeaker.roomId,
            speakerId: currentSpeaker.userId,
            speakerName: currentSpeaker.name,
            originalText: cleanText,
            sourceLanguage: sourceLang,
            timestamp: new Date(),
            messageId,
            $push: {
              translations: {
                recipientId: targetUser.userId,
                targetLanguage: targetLang,
                translatedText,
                translationError,
              },
            },
          },
          { upsert: true, new: true }
        ).catch((dbError) => {
          console.error("Failed to store transcript:", dbError.message);
        });
      } else if (!databaseWarningLogged) {
        databaseWarningLogged = true;
        console.warn(
          "MongoDB is unavailable; transcripts are not being persisted. Captions and audio still work."
        );
      }

      if (audio) {
        targetSocket.emit("tts-audio", {
          speaker: currentSpeaker.name,
          speakerId: currentSpeaker.userId,
          audio,
          language: targetLang,
          mimeType: "audio/wav",
          messageId,
          translatedText,
          ttsError: "",
        });
      } else if (translatedText) {
        // Send translated text for browser TTS fallback
        targetSocket.emit("tts-audio", {
          speaker: currentSpeaker.name,
          speakerId: currentSpeaker.userId,
          audio: null,
          language: targetLang,
          mimeType: "audio/wav",
          messageId,
          translatedText,
          ttsError,
        });
      }
    }
  );
};

const enqueueSpeech = ({ speaker, text, sourceLang }) => {
  const previous =
    translationQueues.get(speaker.socketId) || Promise.resolve();

  const task = previous
    .catch(() => {})
    .then(() => processSpeechText({ speaker, text, sourceLang }))
    .catch((error) => {
      console.error("Speech queue error:", error);
    });

  translationQueues.set(speaker.socketId, task);

  task.then(() => {
    if (translationQueues.get(speaker.socketId) === task) {
      translationQueues.delete(speaker.socketId);
    }
  });

  return task;
};

io.on("connection", (socket) => {
  console.log("✅ Translation user connected:", socket.id);

  socket.on("join-translation", ({ userId, userName, roomId, preferredLanguage } = {}) => {
    if (!userId || !roomId) {
      console.error("❌ join-translation requires userId and roomId", {
        userId,
        roomId,
      });
      return;
    }

    const language = normalizeLangCode(preferredLanguage || "en");

    console.log(`🌍 ${userName} joined translation room ${roomId} with language ${language}`);

    translationUsers.set(socket.id, {
      socketId: socket.id,
      language,
      name: userName || "Guest",
      roomId,
      userId,
    });

    socket.join(roomId);

    socket.emit("translation-joined", {
      userId,
      language,
      languageName: languageNames[language] || language,
    });
  });

  socket.on("change-language", ({ userId, newLanguage } = {}) => {
    if (!newLanguage) return;

    const user = translationUsers.get(socket.id);
    const language = normalizeLangCode(newLanguage);

    /* Only the socket that registered this participant may change the
       preference. A stale or unrelated socket cannot hijack another
       participant's language. */
    if (!user || (userId && user.userId !== userId)) {
      console.error(
        "❌ Ignoring language change from a socket that did not join:",
        userId || socket.id
      );
      return;
    }

    user.language = language;

    console.log(`🔄 ${user.name} changed translation language to ${language}`);

    socket.emit("language-changed", {
      language,
      languageName: languageNames[language] || language,
    });
  });

  socket.on("speech-text", ({ userId, text, originalLanguage, sourceLanguage, isInterim } = {}) => {
    const cleanText = String(text || "").trim();

    console.log(
      `📥 speech-text from ${userId}: "${cleanText}" ${
        isInterim ? "(interim)" : "(final)"
      }`
    );

    if (!cleanText || cleanText.length < 2) return;

    if (isInterim) {
      console.log("⏩ Skipping interim translation/TTS");
      return;
    }

    const speaker = translationUsers.get(socket.id);

    if (!speaker) {
      console.error("❌ Speaker not found:", userId || socket.id);
      return;
    }

    if (userId && speaker.userId !== userId) {
      console.error("❌ Ignoring transcript with a mismatched user id:", userId);
      return;
    }

    const normalizedText = cleanText.toLowerCase().replace(/\s+/g, " ");
    const now = Date.now();
    const previous = lastTranscriptBySocket.get(socket.id);

    if (
      previous &&
      previous.text === normalizedText &&
      now - previous.at < DUPLICATE_TRANSCRIPT_WINDOW_MS
    ) {
      console.log("⏩ Skipping duplicate final transcript:", cleanText);
      return;
    }

    lastTranscriptBySocket.set(socket.id, { text: normalizedText, at: now });

    const sourceLang = normalizeLangCode(
      originalLanguage || sourceLanguage || speaker.language || "en"
    );

    console.log("[TRANSLATE] Processing speech for room:", speaker.roomId, "from:", speaker.name, "lang:", sourceLang);
    enqueueSpeech({ speaker, text: cleanText, sourceLang });
  });

  socket.on("get-languages", () => {
    socket.emit("available-languages", languageNames);
  });

  socket.on("disconnect", () => {
    console.log("❌ Translation user disconnected:", socket.id);

    const user = translationUsers.get(socket.id);

    if (user) {
      console.log(`👋 Removed ${user.name}`);
      translationUsers.delete(socket.id);
      lastTranscriptBySocket.delete(socket.id);
      translationQueues.delete(socket.id);
    }
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "translation",
    database: isDatabaseReady() ? "connected" : "unavailable",
    activeUsers: translationUsers.size,
    users: Array.from(translationUsers.values()).map((u) => ({
      name: u.name,
      language: u.language,
      room: u.roomId,
    })),
  });
});

const requireDatabase = (res) => {
  if (isDatabaseReady()) return false;

  res.status(503).json({
    success: false,
    error:
      "Transcript storage is unavailable because MongoDB is not connected.",
  });
  return true;
};

// Get transcript for a meeting
app.get("/api/transcript/:meetingId", async (req, res) => {
  if (requireDatabase(res)) return;
  try {
    const { meetingId } = req.params;
    const transcripts = await Transcript.find({ meetingId })
      .sort({ timestamp: 1 })
      .lean();
    res.json({ success: true, transcripts });
  } catch (error) {
    console.error("Error fetching transcript:", error);
    res.status(500).json({ success: false, error: "Failed to fetch transcript" });
  }
});

// Generate meeting summary
app.post("/api/summary/generate", async (req, res) => {
  if (requireDatabase(res)) return;
  try {
    const { meetingId, userId } = req.body;
    
    if (!meetingId) {
      return res.status(400).json({ success: false, error: "Meeting ID required" });
    }

    const transcripts = await Transcript.find({ meetingId })
      .sort({ timestamp: 1 })
      .lean();

    if (transcripts.length === 0) {
      return res.status(400).json({ success: false, error: "No transcript available for this meeting" });
    }

    // Simple summarization
    const uniqueSpeakers = new Set(transcripts.map(t => t.speakerId));
    const summary = {
      overview: `Meeting with ${uniqueSpeakers.size} participant(s). Total ${transcripts.length} exchanges.`,
      keyPoints: transcripts.slice(0, Math.min(10, transcripts.length)).map(t => t.originalText),
      decisions: [],
      actionItems: [],
      conclusions: "Meeting discussion recorded.",
    };

    const savedSummary = await MeetingSummary.findOneAndUpdate(
      { meetingId },
      {
        meetingId,
        summary,
        generatedAt: new Date(),
        generatedBy: userId,
        transcriptCount: transcripts.length,
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, summary: savedSummary });
  } catch (error) {
    console.error("Error generating summary:", error);
    res.status(500).json({ success: false, error: "Failed to generate summary" });
  }
});

// Get meeting summary
app.get("/api/summary/:meetingId", async (req, res) => {
  if (requireDatabase(res)) return;
  try {
    const { meetingId } = req.params;
    const summary = await MeetingSummary.findOne({ meetingId }).lean();
    
    if (!summary) {
      return res.status(404).json({ success: false, error: "Summary not found" });
    }
    
    res.json({ success: true, summary });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ success: false, error: "Failed to fetch summary" });
  }
});

const PORT = process.env.PORT || 5000;

const shutdown = (signal) => {
  console.log(`Translation server shutting down (${signal})`);
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Translation Server running on port ${PORT} (0.0.0.0)`);
});