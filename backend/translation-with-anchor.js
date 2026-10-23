require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { translate } = require("@vitalets/google-translate-api");
const { SarvamAIClient } = require("sarvamai");
const cors = require("cors");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  })
);

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

/* -------------------- GLOBAL STATE -------------------- */

const userLanguages = new Map();
const translationCache = new Map();
const anchoringSessions = new Map();

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

/* -------------------- HELPERS -------------------- */

const normalizeLangCode = (lang) => {
  if (!lang) return "en";

  const lower = String(lang).toLowerCase();

  if (lower === "english") return "en";
  if (lower === "malayalam") return "ml";
  if (lower === "hindi") return "hi";
  if (lower === "tamil") return "ta";
  if (lower === "telugu") return "te";
  if (lower === "kannada") return "kn";
  if (lower === "bengali") return "bn";
  if (lower === "gujarati") return "gu";
  if (lower === "marathi") return "mr";
  if (lower === "punjabi") return "pa";
  if (lower === "assamese") return "as";
  if (lower === "urdu") return "ur";
  if (lower === "odia") return "od";
  if (lower === "oriya") return "od";
  if (lower === "or") return "od";

  return lower.split("-")[0];
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

const generateTTS = async (text, lang) => {
  try {
    const targetLang = normalizeLangCode(lang);

    console.log(`🎤 Generating anchor TTS in ${targetLang}: ${text}`);

    const ttsResponse = await client.textToSpeech.convert({
      text,
      target_language_code: languageCodeMap[targetLang] || "en-IN",
    });

    const audio = getBase64Audio(ttsResponse);

    if (audio) {
      console.log(`🔊 Anchor TTS ready, length: ${audio.length}`);
    } else {
      console.error("❌ No audio returned from Sarvam for anchor TTS");
    }

    return audio;
  } catch (error) {
    console.error("❌ Anchor TTS failed:", error.message);
    return null;
  }
};

const translateWithRetry = async (text, sourceLang, targetLang) => {
  const fromLang = normalizeLangCode(sourceLang);
  const toLang = normalizeLangCode(targetLang);

  const cacheKey = `${text}:${fromLang}:${toLang}`;

  if (translationCache.has(cacheKey)) {
    console.log(`⚡ Cache hit: ${cacheKey}`);
    return translationCache.get(cacheKey);
  }

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await translate(text, {
        from: fromLang,
        to: toLang,
      });

      const translatedText = result.text;

      translationCache.set(cacheKey, translatedText);

      if (translationCache.size > CACHE_SIZE) {
        const firstKey = translationCache.keys().next().value;
        translationCache.delete(firstKey);
      }

      return translatedText;
    } catch (error) {
      lastError = error;
      console.error(`❌ Translation attempt ${attempt} failed:`, error.message);

      if (attempt < 2) {
        await sleep(1200);
      }
    }
  }

  throw lastError;
};

/* -------------------- AI ANCHOR SCRIPT GENERATOR -------------------- */

class AIScriptGenerator {
  generateIntroductionScript(scheduleItem, language) {
    const lang = normalizeLangCode(language);
    const speakerName =
      scheduleItem.speakerName || scheduleItem.name || scheduleItem.participant || "the speaker";
    const topic =
      scheduleItem.topic || scheduleItem.title || scheduleItem.speakerTitle || "their topic";
    const duration = scheduleItem.duration || scheduleItem.time || 1;

    const scripts = {
      en: `Welcome everyone! Our next presenter is ${speakerName}, who will be speaking on "${topic}". You have ${duration} minute${duration > 1 ? "s" : ""}. Please begin when ready.`,
      hi: `नमस्ते सभी को! हमारे अगले प्रस्तुतकर्ता ${speakerName} हैं, जो "${topic}" पर बोलेंगे। आपके पास ${duration} मिनट हैं। कृपया तैयार होने पर शुरू करें।`,
      ml: `എല്ലാവർക്കും നമസ്കാരം! നമ്മുടെ അടുത്ത പ്രസന്റർ ${speakerName} ആണ്, "${topic}" എന്ന വിഷയത്തെക്കുറിച്ച് സംസാരിക്കും. നിങ്ങൾക്ക് ${duration} മിനിറ്റ് സമയമുണ്ട്. തയ്യാറാകുമ്പോൾ ആരംഭിക്കുക.`,
      ta: `அனைவருக்கும் வணக்கம்! எங்கள் அடுத்த வழங்குநர் ${speakerName}, "${topic}" பற்றி பேசுவார். உங்களுக்கு ${duration} நிமிடங்கள் உள்ளன. தயாரானதும் தொடங்கவும்.`,
    };

    return scripts[lang] || scripts.en;
  }

  generateTimeWarningScript(scheduleItem, timeLeft, language) {
    const lang = normalizeLangCode(language);
    const speakerName =
      scheduleItem.speakerName || scheduleItem.name || scheduleItem.participant || "Speaker";

    const timeText = timeLeft === 0.5 ? "30 seconds" : `${timeLeft} minute`;

    const scripts = {
      en: `${speakerName}, you have ${timeText} remaining. Please wrap up soon.`,
      hi: `${speakerName}, आपके पास ${timeLeft === 0.5 ? "30 सेकंड" : "1 मिनट"} बचा है। कृपया जल्दी समाप्त करें।`,
      ml: `${speakerName}, നിങ്ങൾക്ക് ${timeLeft === 0.5 ? "30 സെക്കൻഡ്" : "1 മിനിറ്റ്"} മാത്രമേ ബാക്കിയുള്ളൂ. ദയവായി വേഗത്തിൽ അവസാനിപ്പിക്കുക.`,
      ta: `${speakerName}, உங்களுக்கு ${timeLeft === 0.5 ? "30 விநாடிகள்" : "1 நிமிடம்"} மட்டுமே உள்ளது. விரைவில் முடிக்கவும்.`,
    };

    return scripts[lang] || scripts.en;
  }

  generateTransitionScript(completedSpeaker, nextSpeaker, language) {
    const lang = normalizeLangCode(language);

    const completedName =
      completedSpeaker.speakerName ||
      completedSpeaker.name ||
      completedSpeaker.participant ||
      "the speaker";

    const nextName =
      nextSpeaker.speakerName || nextSpeaker.name || nextSpeaker.participant || "the next speaker";

    const nextTopic =
      nextSpeaker.topic || nextSpeaker.title || nextSpeaker.speakerTitle || "their topic";

    const scripts = {
      en: `Thank you ${completedName} for that presentation. Now, let's welcome ${nextName}, who will speak on "${nextTopic}".`,
      hi: `${completedName} जी को उनकी प्रस्तुति के लिए धन्यवाद। अब ${nextName} का स्वागत करते हैं, जो "${nextTopic}" पर बोलेंगे।`,
      ml: `${completedName}-ന് അവതരണത്തിന് നന്ദി. ഇനി "${nextTopic}" എന്ന വിഷയത്തിൽ സംസാരിക്കുന്ന ${nextName}-യെ സ്വാഗതം ചെയ്യാം.`,
      ta: `${completedName}-க்கு அவர்களின் விளக்கத்திற்காக நன்றி. இப்போது "${nextTopic}" பற்றி பேசும் ${nextName}-ஐ வரவேற்கலாம்.`,
    };

    return scripts[lang] || scripts.en;
  }

  generateClosingScript(meetingTitle, language) {
    const lang = normalizeLangCode(language);

    const scripts = {
      en: `That concludes our session "${meetingTitle}". Thank you all for your participation. Have a wonderful day!`,
      hi: `इसके साथ हमारा "${meetingTitle}" सत्र समाप्त होता है। आप सभी की भागीदारी के लिए धन्यवाद। शुभ दिन!`,
      ml: `ഇതോടെ ഞങ്ങളുടെ "${meetingTitle}" സെഷൻ അവസാനിക്കുന്നു. എല്ലാവരുടെയും പങ്കാളിത്തത്തിന് നന്ദി. നല്ല ദിവസം ആശംസിക്കുന്നു!`,
      ta: `இதோடு எங்கள் "${meetingTitle}" அமர்வு முடிகிறது. அனைவரின் பங்கேற்புக்கும் நன்றி. இனிய நாள்!`,
    };

    return scripts[lang] || scripts.en;
  }
}

const scriptGenerator = new AIScriptGenerator();

/* -------------------- ANCHORING SESSION CLASS -------------------- */

class AnchoringSession {
  constructor(roomId, creatorId, settings) {
    this.roomId = roomId;
    this.creatorId = creatorId;
    this.settings = settings || {};
    this.schedule = this.settings.schedule || [];
    this.currentIndex = -1;
    this.isActive = false;
    this.currentSpeaker = null;
    this.timerInterval = null;
    this.isTimerRunning = false;
    this.timeRemaining = 0;
    this.language = normalizeLangCode(this.settings.language || "en");
  }

  async start(io) {
    if (!this.schedule || this.schedule.length === 0) {
      console.error("❌ Cannot start anchoring: schedule is empty");
      io.to(this.roomId).emit("anchoring-error", {
        message: "Cannot start anchoring because schedule is empty.",
      });
      return;
    }

    this.isActive = true;
    this.currentIndex = 0;

    console.log(`🎤 Anchoring started for room ${this.roomId}`);

    io.to(this.roomId).emit("anchoring-started", {
      schedule: this.schedule,
      currentIndex: this.currentIndex,
      timestamp: Date.now(),
    });

    await this.moveToCurrentSpeaker(io);
  }

  async moveToCurrentSpeaker(io) {
    if (this.currentIndex >= this.schedule.length) {
      await this.endSession(io);
      return;
    }

    this.currentSpeaker = this.schedule[this.currentIndex];

    const duration = Number(
      this.currentSpeaker.duration || this.currentSpeaker.time || this.currentSpeaker.minutes || 1
    );

    this.timeRemaining = duration * 60;

    const introScript = scriptGenerator.generateIntroductionScript(
      this.currentSpeaker,
      this.language
    );

    await this.speakScript(introScript, io);

    io.to(this.roomId).emit("speaker-changed", {
      currentSpeaker: this.currentSpeaker,
      currentIndex: this.currentIndex,
      totalSpeakers: this.schedule.length,
      timeRemaining: this.timeRemaining,
      timestamp: Date.now(),
      serverTime: new Date().toISOString(),
    });

    io.to(this.roomId).emit("anchoring-control", {
      action: "unmute-speaker",
      speakerId: this.currentSpeaker.userId,
      speakerName:
        this.currentSpeaker.speakerName ||
        this.currentSpeaker.name ||
        this.currentSpeaker.participant ||
        "Speaker",
    });

    this.startTimer(io);
  }

  startTimer(io) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.isTimerRunning = true;

    this.timerInterval = setInterval(async () => {
      if (!this.isActive) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.isTimerRunning = false;
        return;
      }

      this.timeRemaining--;

      io.to(this.roomId).emit("time-update", {
        timeRemaining: this.timeRemaining,
        currentSpeaker: this.currentSpeaker,
        timestamp: Date.now(),
        serverTime: new Date().toISOString(),
      });

      if (this.timeRemaining === 60) {
        const warningScript = scriptGenerator.generateTimeWarningScript(
          this.currentSpeaker,
          1,
          this.language
        );
        await this.speakScript(warningScript, io);
      }

      if (this.timeRemaining === 30) {
        const warningScript = scriptGenerator.generateTimeWarningScript(
          this.currentSpeaker,
          0.5,
          this.language
        );
        await this.speakScript(warningScript, io);
      }

      if (this.timeRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.isTimerRunning = false;

        io.to(this.roomId).emit("anchoring-control", {
          action: "mute-speaker",
          speakerId: this.currentSpeaker?.userId,
          speakerName:
            this.currentSpeaker?.speakerName ||
            this.currentSpeaker?.name ||
            this.currentSpeaker?.participant ||
            "Speaker",
          message: "Time is up",
        });

        const completedSpeaker = this.currentSpeaker;
        const nextIndex = this.currentIndex + 1;

        if (nextIndex < this.schedule.length) {
          const nextSpeaker = this.schedule[nextIndex];

          const transitionScript = scriptGenerator.generateTransitionScript(
            completedSpeaker,
            nextSpeaker,
            this.language
          );

          await this.speakScript(transitionScript, io);
        }

        this.currentIndex++;
        await this.moveToCurrentSpeaker(io);
      }
    }, 1000);
  }

  async speakScript(script, io) {
    try {
      console.log(`📢 AI Anchor script for room ${this.roomId}: ${script}`);

      const roomUsers = Array.from(userLanguages.values()).filter(
        (u) => u.roomId === this.roomId
      );

      io.to(this.roomId).emit("anchor-announcement", {
        speaker: "AI Anchor",
        script,
        timestamp: new Date().toISOString(),
      });

      if (roomUsers.length === 0) {
        console.log("ℹ️ No registered users found for anchor TTS. Sending room fallback.");

        const audio = await generateTTS(script, this.language);

        io.to(this.roomId).emit("anchor-tts", {
          speaker: "AI Anchor",
          script,
          audio,
          language: this.language,
          timestamp: new Date().toISOString(),
        });

        return;
      }

      for (const user of roomUsers) {
        const targetLang = normalizeLangCode(user.language || "en");
        let translatedScript = script;

        if (targetLang !== this.language) {
          try {
            translatedScript = await translateWithRetry(script, this.language, targetLang);
            console.log(`🌐 Anchor translated for ${user.name}: ${translatedScript}`);
          } catch (err) {
            console.error(`❌ Anchor translation failed for ${user.name}:`, err.message);
          }
        }

        const audio = await generateTTS(translatedScript, targetLang);
        const targetSocket = io.sockets.sockets.get(user.socketId);

        if (targetSocket) {
          targetSocket.emit("anchor-tts", {
            speaker: "AI Anchor",
            script: translatedScript,
            audio,
            language: targetLang,
            timestamp: new Date().toISOString(),
          });

          console.log(`✅ Sent anchor TTS to ${user.name} in ${targetLang}`);
        }
      }
    } catch (error) {
      console.error("❌ speakScript failed:", error.message);

      io.to(this.roomId).emit("anchor-announcement", {
        speaker: "AI Anchor",
        script,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async endSession(io) {
    this.isActive = false;
    this.isTimerRunning = false;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const closingScript = scriptGenerator.generateClosingScript(
      this.settings.meetingTitle || "Meeting",
      this.language
    );

    await this.speakScript(closingScript, io);

    io.to(this.roomId).emit("anchoring-ended", {
      message: "Anchoring session completed",
      timestamp: Date.now(),
    });

    anchoringSessions.delete(this.roomId);

    console.log(`✅ Anchoring ended for room ${this.roomId}`);
  }

  pause(io) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.isActive = false;
    this.isTimerRunning = false;

    io.to(this.roomId).emit("anchoring-paused", {
      timeRemaining: this.timeRemaining,
      currentSpeaker: this.currentSpeaker,
    });

    console.log(`⏸️ Anchoring paused for room ${this.roomId}`);
  }

  resume(io) {
    if (!this.currentSpeaker) return;

    this.isActive = true;
    this.isTimerRunning = false;

    io.to(this.roomId).emit("anchoring-resumed", {
      timeRemaining: this.timeRemaining,
      currentSpeaker: this.currentSpeaker,
    });

    this.startTimer(io);

    console.log(`▶️ Anchoring resumed for room ${this.roomId}`);
  }
}

/* -------------------- SOCKET.IO -------------------- */

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  /* ---------- TRANSLATION EVENTS ---------- */

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
          translatedText = await translateWithRetry(text.trim(), sourceLang, targetLang);

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

  /* ---------- ANCHORING EVENTS ---------- */

  socket.on("join-anchoring-room", ({ roomId, userId, userName, language }) => {
    const normalizedLanguage = normalizeLangCode(language || "en");

    socket.join(roomId);

    const existingUser = userLanguages.get(userId);

    if (existingUser) {
      existingUser.socketId = socket.id;
      existingUser.roomId = roomId;
      existingUser.language = normalizedLanguage;
      existingUser.name = userName || existingUser.name || "Guest";
    } else {
      userLanguages.set(userId, {
        socketId: socket.id,
        language: normalizedLanguage,
        name: userName || "Guest",
        roomId,
        userId,
      });
    }

    console.log(
      `🎤 ${userName || userId} joined anchoring room ${roomId} with language ${normalizedLanguage}`
    );

    socket.emit("anchoring-room-joined", {
      roomId,
      userId,
      language: normalizedLanguage,
    });
  });

  socket.on("enable-anchoring", ({ roomId, creatorId, settings }) => {
    console.log("🎤 Enabling anchoring for room:", roomId);

    const session = new AnchoringSession(roomId, creatorId, settings || {});
    anchoringSessions.set(roomId, session);

    socket.join(roomId);

    io.to(roomId).emit("anchoring-enabled", {
      roomId,
      schedule: session.schedule,
      creatorId,
      settings: session.settings,
      timestamp: Date.now(),
    });
  });

  socket.on("start-anchoring", async ({ roomId }) => {
    console.log("▶️ Received start-anchoring event for room:", roomId);

    const session = anchoringSessions.get(roomId);

    console.log("Session found:", !!session, "Session active:", session?.isActive);

    if (session && !session.isActive) {
      await session.start(io);
    } else {
      console.error("❌ Cannot start anchoring:", {
        sessionExists: !!session,
        isActive: session?.isActive,
      });

      socket.emit("anchoring-error", {
        message: "Cannot start anchoring. Session not found or already active.",
      });
    }
  });

  socket.on("pause-anchoring", ({ roomId }) => {
    const session = anchoringSessions.get(roomId);

    if (session) {
      session.pause(io);
    }
  });

  socket.on("resume-anchoring", ({ roomId }) => {
    const session = anchoringSessions.get(roomId);

    if (session) {
      session.resume(io);
    }
  });

  socket.on("skip-speaker", async ({ roomId }) => {
    const session = anchoringSessions.get(roomId);

    if (session && session.isActive) {
      if (session.timerInterval) {
        clearInterval(session.timerInterval);
        session.timerInterval = null;
      }

      session.currentIndex++;
      await session.moveToCurrentSpeaker(io);
    }
  });

  socket.on("stop-anchoring", async ({ roomId }) => {
    const session = anchoringSessions.get(roomId);

    if (session) {
      await session.endSession(io);
    }
  });

  socket.on("reset-anchoring", ({ roomId }) => {
    console.log("🔄 Resetting anchoring for room:", roomId);

    const session = anchoringSessions.get(roomId);

    if (session) {
      if (session.timerInterval) {
        clearInterval(session.timerInterval);
        session.timerInterval = null;
      }

      session.isActive = false;
      session.isTimerRunning = false;
      session.currentIndex = 0;
      session.timeRemaining = 0;
      session.currentSpeaker = null;
    }

    io.to(roomId).emit("anchoring-reset", {
      timestamp: Date.now(),
      serverTime: new Date().toISOString(),
    });
  });

  socket.on("restart-anchoring", async ({ roomId }) => {
    console.log("🔁 Restarting anchoring for room:", roomId);

    const session = anchoringSessions.get(roomId);

    if (session) {
      if (session.timerInterval) {
        clearInterval(session.timerInterval);
        session.timerInterval = null;
      }

      session.currentIndex = 0;
      session.timeRemaining = 0;
      session.currentSpeaker = null;
      session.isActive = true;
      session.isTimerRunning = false;

      io.to(roomId).emit("anchoring-restarted", {
        timestamp: Date.now(),
        serverTime: new Date().toISOString(),
      });

      await session.moveToCurrentSpeaker(io);
    }
  });

  socket.on("get-anchoring-status", ({ roomId }, callback) => {
    const session = anchoringSessions.get(roomId);

    if (session) {
      callback({
        isActive: session.isActive,
        isAnchoringEnabled: true,
        currentSpeaker: session.currentSpeaker,
        currentIndex: session.currentIndex,
        schedule: session.schedule,
        timeRemaining: session.timeRemaining,
      });
    } else {
      callback({
        isActive: false,
        isAnchoringEnabled: false,
      });
    }
  });

  socket.on("update-anchor-language", ({ roomId, userId, language }) => {
    const normalizedLanguage = normalizeLangCode(language || "en");

    const user = userLanguages.get(userId);

    if (user) {
      user.language = normalizedLanguage;
      user.roomId = roomId || user.roomId;

      console.log(`🌐 Updated anchor language for ${user.name}: ${normalizedLanguage}`);
    }

    socket.emit("anchor-language-updated", {
      userId,
      language: normalizedLanguage,
    });
  });

  /* ---------- DISCONNECT ---------- */

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

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

/* -------------------- REST ROUTES -------------------- */

app.get("/api/anchoring/status/:roomId", (req, res) => {
  const session = anchoringSessions.get(req.params.roomId);

  if (session) {
    res.json({
      isActive: session.isActive,
      currentSpeaker: session.currentSpeaker,
      currentIndex: session.currentIndex,
      schedule: session.schedule,
      timeRemaining: session.timeRemaining,
    });
  } else {
    res.json({ isActive: false });
  }
});

app.post("/api/anchoring/schedule", (req, res) => {
  const { roomId, schedule } = req.body;

  const session = anchoringSessions.get(roomId);

  if (session) {
    session.schedule = schedule;
    res.json({ success: true, schedule });
  } else {
    res.status(404).json({ error: "Anchoring session not found" });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    activeUsers: userLanguages.size,
    activeAnchoringSessions: anchoringSessions.size,
    users: Array.from(userLanguages.values()).map((u) => ({
      name: u.name,
      language: u.language,
      room: u.roomId,
    })),
    anchoringRooms: Array.from(anchoringSessions.keys()),
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Translation + AI Anchoring Server running on port ${PORT}`);
});