require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { SarvamAIClient } = require("sarvamai");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const { translate: googleTranslate } = require("@vitalets/google-translate-api");
const { connectMongo, describeMongoError } = require("./config/database");

const app = express();

app.use(cors({
  origin: "*",
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
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  },
});

(async () => {
  try {
    await connectMongo();
  } catch (error) {
    console.error(
      "Translation service MongoDB initialization failed:",
      describeMongoError(error)
    );
    process.exit(1);
  }
})();

const userLanguages = new Map();
const translationCache = new Map();
const CACHE_SIZE = 100;

/* Recognition engines often re-emit the same final phrase after a
   restart. Drop only an exact repeat inside this short window; do not
   throw away different phrases just because they arrived quickly. */
const lastTranscriptByUser = new Map();
const DUPLICATE_TRANSCRIPT_WINDOW_MS = 8000;

/* One queue per speaker preserves caption order when a provider call is
   slower than the next transcript segment. */
const translationQueues = new Map();

const languageCodeMap = {
  en: "en-IN",
  ml: "ml-IN",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  mr: "mr-IN",
  pa: "pa-IN",
  ur: "ur-IN",
  as: "as-IN",
  od: "od-IN",
  or: "od-IN",
};

const languageNames = {
  en: "English",
  ml: "Malayalam",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  bn: "Bengali",
  gu: "Gujarati",
  mr: "Marathi",
  od: "Odia",
  pa: "Punjabi",
  as: "Assamese",
  ur: "Urdu",
};

const normalizeLangCode = (lang) => {
  if (!lang) return "en";
  if (lang === "or") return "od";
  return lang.split("-")[0];
};

const withTimeout = (promise, ms, label) => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
  });

  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timeoutId)
  );
};

/* MyMemory and Google both use `or` for Odia; the UI uses `od`. */
const providerLanguageCode = (language) => {
  const normalized = normalizeLangCode(language);
  return normalized === "od" || normalized === "or" ? "or" : normalized;
};

const getBase64Audio = (ttsResponse) => {
  return (
    ttsResponse?.audio ||
    ttsResponse?.data ||
    ttsResponse?.audios?.[0] ||
    ttsResponse?.outputs?.[0]?.audio ||
    null
  );
};

const translateWithMyMemory = async (text, sourceLang, targetLang) => {
  const response = await withTimeout(
    axios.get("https://api.mymemory.translated.net/get", {
      params: {
        q: text,
        langpair: `${providerLanguageCode(sourceLang)}|${providerLanguageCode(
          targetLang
        )}`,
      },
      timeout: 10000,
    }),
    12000,
    "MyMemory translation"
  );

  const status = Number(response.data?.responseStatus);
  const translatedText = String(
    response.data?.responseData?.translatedText || ""
  ).trim();

  if (status !== 200 || !translatedText) {
    throw new Error(
      `MyMemory returned status ${
        response.data?.responseStatus || "unknown"
      }`
    );
  }

  if (
    /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE PAIR|PLEASE SELECT TWO DISTINCT/i.test(
      translatedText
    )
  ) {
    throw new Error(`MyMemory error: ${translatedText}`);
  }

  return translatedText;
};

const translateWithGoogle = async (text, sourceLang, targetLang) => {
  const response = await withTimeout(
    googleTranslate(text, {
      from: providerLanguageCode(sourceLang),
      to: providerLanguageCode(targetLang),
    }),
    12000,
    "Google Translate"
  );

  const translatedText = String(response?.text || "").trim();

  if (!translatedText) {
    throw new Error("Google Translate returned empty text");
  }

  return translatedText;
};

const translateWithRetry = async (text, sourceLang, targetLang) => {
  const cleanText = String(text || "").trim();
  const source = normalizeLangCode(sourceLang);
  const target = normalizeLangCode(targetLang);

  if (!cleanText) {
    throw new Error("Cannot translate empty text");
  }

  if (source === target) {
    return cleanText;
  }

  if (!languageNames[source] || !languageNames[target]) {
    throw new Error(`Unsupported language pair: ${source} -> ${target}`);
  }

  const cacheKey = `${cleanText}:${source}:${target}`;

  if (translationCache.has(cacheKey)) {
    console.log(`⚡ Cache hit: ${cacheKey}`);
    return translationCache.get(cacheKey);
  }

  const providers = [
    { name: "MyMemory", run: translateWithMyMemory },
    { name: "Google Translate", run: translateWithGoogle },
  ];

  let lastError = null;

  for (const provider of providers) {
    try {
      const translatedText = await provider.run(cleanText, source, target);

      translationCache.set(cacheKey, translatedText);

      if (translationCache.size > CACHE_SIZE) {
        const firstKey = translationCache.keys().next().value;
        translationCache.delete(firstKey);
      }

      return translatedText;
    } catch (error) {
      lastError = error;
      console.error(
        `❌ ${provider.name} failed (${source} -> ${target}):`,
        error.message
      );
    }
  }

  throw lastError || new Error("Translation failed");
};

const processSpeechText = async ({ speaker, text, sourceLang }) => {
  const currentSpeaker = userLanguages.get(speaker.userId);

  if (
    !currentSpeaker ||
    currentSpeaker.socketId !== speaker.socketId ||
    currentSpeaker.roomId !== speaker.roomId
  ) {
    console.log("Skipping queued transcript for a user who left:", speaker.userId);
    return;
  }

  const cleanText = text.trim();
  const roomUsers = Array.from(userLanguages.values()).filter(
    (user) =>
      user.roomId === currentSpeaker.roomId &&
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
        translatedText = await translateWithRetry(
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

      if (client) {
        try {
          console.log(
            `🎤 Generating TTS for ${targetUser.name} in ${targetLang}: ${translatedText}`
          );

          const ttsResponse = await withTimeout(
            client.textToSpeech.convert({
              text: translatedText,
              target_language_code: languageCodeMap[targetLang] || "en-IN",
              output_audio_codec: "wav",
            }),
            20000,
            "Sarvam TTS"
          );

          audio = getBase64Audio(ttsResponse);

          if (audio) {
            console.log(
              `🔊 TTS ready for ${targetUser.name}, length: ${audio.length}`
            );
          } else {
            console.error("❌ No audio returned from Sarvam TTS");
          }
        } catch (ttsError) {
          console.error(
            `❌ TTS failed for ${targetUser.name}:`,
            ttsError.message
          );
        }
      }

      return {
        targetUser,
        translatedText,
        targetLang,
        audio,
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
      };
    }
  });

  const results = await Promise.all(translationTasks);

  results.forEach(
    ({ targetUser, translatedText, targetLang, audio, translationError }) => {
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

      // Store transcript in database
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

      if (audio) {
        targetSocket.emit("tts-audio", {
          speaker: currentSpeaker.name,
          speakerId: currentSpeaker.userId,
          audio,
          language: targetLang,
          mimeType: "audio/wav",
          messageId,
          translatedText,
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
        });
      }
    }
  );
};

const enqueueSpeech = ({ speaker, text, sourceLang }) => {
  const previous = translationQueues.get(speaker.userId) || Promise.resolve();

  const task = previous
    .catch(() => {})
    .then(() => processSpeechText({ speaker, text, sourceLang }))
    .catch((error) => {
      console.error("Speech queue error:", error);
    });

  translationQueues.set(speaker.userId, task);

  task.then(() => {
    if (translationQueues.get(speaker.userId) === task) {
      translationQueues.delete(speaker.userId);
    }
  });

  return task;
};

io.on("connection", (socket) => {
  console.log("✅ Translation user connected:", socket.id);

  socket.on("join-translation", ({ userId, userName, roomId, preferredLanguage }) => {
    const language = normalizeLangCode(preferredLanguage || "en");

    console.log(`🌍 ${userName} joined translation room ${roomId} with language ${language}`);

    userLanguages.set(userId, {
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
    if (!userId || !newLanguage) return;

    const user = userLanguages.get(userId);
    const language = normalizeLangCode(newLanguage);

    if (!user || user.socketId !== socket.id) {
      console.error(
        "❌ Ignoring language change from a mismatched socket:",
        userId
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

  socket.on("speech-text", ({ userId, text, originalLanguage, isInterim } = {}) => {
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

    const speaker = userLanguages.get(userId);

    if (!speaker) {
      console.error("❌ Speaker not found:", userId);
      return;
    }

    if (speaker.socketId !== socket.id) {
      console.error("❌ Ignoring transcript from a mismatched socket:", userId);
      return;
    }

    const normalizedText = cleanText.toLowerCase().replace(/\s+/g, " ");
    const now = Date.now();
    const previous = lastTranscriptByUser.get(userId);

    if (
      previous &&
      previous.text === normalizedText &&
      now - previous.at < DUPLICATE_TRANSCRIPT_WINDOW_MS
    ) {
      console.log("⏩ Skipping duplicate final transcript:", cleanText);
      return;
    }

    lastTranscriptByUser.set(userId, { text: normalizedText, at: now });

    const sourceLang = normalizeLangCode(
      originalLanguage || speaker.language || "en"
    );

    console.log("[TRANSLATE] Processing speech for room:", speaker.roomId, "from:", speaker.name, "lang:", sourceLang);
    enqueueSpeech({ speaker, text: cleanText, sourceLang });
  });

  socket.on("get-languages", () => {
    socket.emit("available-languages", languageNames);
  });

  socket.on("disconnect", () => {
    console.log("❌ Translation user disconnected:", socket.id);

    for (const [userId, user] of userLanguages.entries()) {
      if (user.socketId === socket.id) {
        console.log(`👋 Removed ${user.name}`);
        userLanguages.delete(userId);
        lastTranscriptByUser.delete(userId);
        translationQueues.delete(userId);
        break;
      }
    }
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    activeUsers: userLanguages.size,
    users: Array.from(userLanguages.values()).map((u) => ({
      name: u.name,
      language: u.language,
      room: u.roomId,
    })),
  });
});

// Get transcript for a meeting
app.get("/api/transcript/:meetingId", async (req, res) => {
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Translation Server running on port ${PORT}`);
});