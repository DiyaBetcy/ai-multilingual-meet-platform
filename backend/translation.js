const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { SarvamAIClient } = require("sarvamai");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  credentials: false
}));

app.use(express.json());

const client = new SarvamAIClient({
  apiSubscriptionKey: process.env.SARVAM_API_KEY,
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  },
});

const userLanguages = new Map();
const translationCache = new Map();
const CACHE_SIZE = 100;

const lastTranslationByUser = new Map();
const TRANSLATION_COOLDOWN_MS = 3500;

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getBase64Audio = (ttsResponse) => {
  return (
    ttsResponse?.audio ||
    ttsResponse?.data ||
    ttsResponse?.audios?.[0] ||
    ttsResponse?.outputs?.[0]?.audio ||
    null
  );
};

const translateWithRetry = async (text, sourceLang, targetLang) => {
  const cacheKey = `${text}:${sourceLang}:${targetLang}`;

  if (translationCache.has(cacheKey)) {
    console.log(`⚡ Cache hit: ${cacheKey}`);
    return translationCache.get(cacheKey);
  }

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // Use MyMemory API (free, no rate limits)
      const langPair = `${sourceLang}|${targetLang}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
      
      const response = await axios.get(url);
      const translatedText = response.data.responseData.translatedText;

      translationCache.set(cacheKey, translatedText);

      if (translationCache.size > CACHE_SIZE) {
        const firstKey = translationCache.keys().next().value;
        translationCache.delete(firstKey);
      }

      return translatedText;
    } catch (error) {
      lastError = error;
      console.error(
        `❌ Translation attempt ${attempt} failed:`,
        error.message
      );

      if (attempt < 2) {
        await sleep(1200);
      }
    }
  }

  throw lastError;
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

  socket.on("change-language", ({ userId, newLanguage }) => {
    const user = userLanguages.get(userId);
    const language = normalizeLangCode(newLanguage);

    if (user) {
      user.language = language;

      console.log(`🔄 ${user.name} changed translation language to ${language}`);

      socket.emit("language-changed", {
        language,
        languageName: languageNames[language] || language,
      });
    }
  });

  socket.on("speech-text", async ({ userId, text, originalLanguage, isInterim }) => {
    console.log(
      `📥 speech-text from ${userId}: "${text}" ${isInterim ? "(interim)" : "(final)"}`
    );

    if (!text || text.trim().length < 2) return;

    if (isInterim) {
      console.log("⏩ Skipping interim translation/TTS");
      return;
    }

    const now = Date.now();
    const lastTime = lastTranslationByUser.get(userId) || 0;

    if (now - lastTime < TRANSLATION_COOLDOWN_MS) {
      console.log("⏳ Skipping translation to avoid Google rate limit");
      return;
    }

    lastTranslationByUser.set(userId, now);

    const speaker = userLanguages.get(userId);

    if (!speaker) {
      console.error("❌ Speaker not found:", userId);
      return;
    }

    const sourceLang = normalizeLangCode(originalLanguage || "en");

    const roomUsers = Array.from(userLanguages.values()).filter(
      (u) => u.roomId === speaker.roomId && u.userId !== userId
    );

    console.log(
      `👥 Receivers in room ${speaker.roomId}:`,
      roomUsers.map((u) => `${u.name}:${u.language}`).join(", ") || "none"
    );

    if (roomUsers.length === 0) {
      console.log("ℹ️ No other participants to receive translation");
      return;
    }

    const translationTasks = roomUsers.map(async (targetUser) => {
      const targetLang = normalizeLangCode(targetUser.language || "en");

      try {
        let translatedText = text.trim();

        if (targetLang !== sourceLang) {
          translatedText = await translateWithRetry(
            text.trim(),
            sourceLang,
            targetLang
          );

          console.log(
            `🔄 Translated for ${targetUser.name}: ${sourceLang} → ${targetLang}: ${translatedText}`
          );
        } else {
          console.log(`ℹ️ Same language for ${targetUser.name}, using original text`);
        }

        let audio = null;

        try {
          console.log(
            `🎤 Generating TTS for ${targetUser.name} in ${targetLang}: ${translatedText}`
          );

          const ttsResponse = await client.textToSpeech.convert({
            text: translatedText,
            target_language_code: languageCodeMap[targetLang] || "en-IN",
          });

          audio = getBase64Audio(ttsResponse);

          if (audio) {
            console.log(`🔊 TTS ready for ${targetUser.name}, length: ${audio.length}`);
          } else {
            console.error("❌ No audio returned from Sarvam TTS");
          }
        } catch (ttsError) {
          console.error(`❌ TTS failed for ${targetUser.name}:`, ttsError.message);
        }

        return {
          targetUser,
          translatedText,
          targetLang,
          audio,
        };
      } catch (error) {
        console.error(`❌ Translation failed for ${targetUser.name}:`, error.message);

        return {
          targetUser,
          translatedText: text.trim(),
          targetLang,
          audio: null,
        };
      }
    });

    const results = await Promise.all(translationTasks);

    results.forEach(({ targetUser, translatedText, targetLang, audio }) => {
      const targetSocket = io.sockets.sockets.get(targetUser.socketId);

      if (!targetSocket) return;

      targetSocket.emit("translated-caption", {
        speaker: speaker.name,
        text: text.trim(),
        translatedText,
        targetLanguage: targetLang,
        isOriginal: targetLang === sourceLang,
        isInterim: false,
      });

      if (audio) {
        targetSocket.emit("tts-audio", {
          speaker: speaker.name,
          audio,
          language: targetLang,
        });
      }
    });
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
        lastTranslationByUser.delete(userId);
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

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Translation Server running on port ${PORT}`);
});