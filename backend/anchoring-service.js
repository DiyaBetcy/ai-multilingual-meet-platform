require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { translate } = require('@vitalets/google-translate-api');
const { SarvamAIClient } = require('sarvamai');

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN)
  ? (process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [
      'https://meet-ai-anchoring.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
    ];

app.use(cors({ origin: allowedOrigins, credentials: false }));
app.use(express.json());

// Sarvam AI client credentials must come from the environment. Never
// hardcode API keys in source: SARVAM_API_KEY belongs in backend/.env or
// the deployment's secret store.
const sarvamApiKey = process.env.SARVAM_API_KEY;

if (!sarvamApiKey) {
  console.warn(
    "SARVAM_API_KEY is not configured; AI anchoring TTS will be unavailable until it is set."
  );
}

const client = sarvamApiKey
  ? new SarvamAIClient({ apiSubscriptionKey: sarvamApiKey })
  : null;

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

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: false,
  },
});

io.engine.on("connection_error", (error) => {
  console.error("Anchoring Socket.IO connection error:", {
    code: error?.code,
    message: error?.message,
    context: error?.context,
  });
});

// Store anchoring sessions
const anchoringSessions = new Map();

// Store user language preferences: roomId -> [{ userId, socketId, language }]
const userLanguages = new Map();

const anchorLanguageByCode = {
  en: 'en-US',
  hi: 'hi-IN',
  ta: 'ta-IN',
  ml: 'ml-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  gu: 'gu-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  pa: 'pa-IN',
  ur: 'ur-IN',
  od: 'or-IN',
  or: 'or-IN',
  as: 'as-IN',
};

/* The dashboard sends short ISO codes (en, ml), while the script
   templates and Sarvam expect BCP-47 locales (en-US, ml-IN). */
const normalizeAnchorLanguage = (language) => {
  const raw = String(language || 'en');
  if (raw.includes('-')) {
    const code = raw.split('-')[0].toLowerCase();
    return anchorLanguageByCode[code] || 'en-US';
  }
  return anchorLanguageByCode[raw.toLowerCase()] || 'en-US';
};

// Language mapping for Sarvam AI
const languageMapping = {
  'en-US': 'en-IN',
  'hi-IN': 'hi-IN',
  'ta-IN': 'ta-IN',
  'ml-IN': 'ml-IN',
  'te-IN': 'te-IN',
  'kn-IN': 'kn-IN',
  'gu-IN': 'gu-IN',
  'mr-IN': 'mr-IN',
  'bn-IN': 'bn-IN',
  'pa-IN': 'pa-IN',
  'ur-IN': 'ur-IN',
  'or-IN': 'od-IN',
  'od-IN': 'od-IN',
  'as-IN': 'as-IN'
};

// AI Script Generator
class AIScriptGenerator {
  generateIntroductionScript(scheduleItem, language) {
    const { speakerName, topic, duration } = scheduleItem;
    
    const scripts = {
      'en-US': `Welcome everyone! Our next presenter is ${speakerName}, who will be speaking on "${topic}". You have ${duration} minutes. Please begin when ready.`,
      'hi-IN': `नमस्ते सभी को! हमारे अगले प्रस्तुतकर्ता ${speakerName} हैं, जो "${topic}" पर बोलेंगे। आपके पास ${duration} मिनट हैं। कृपया तैयार होने पर शुरू करें।`,
      'ml-IN': `എല്ലാവർക്കും നമസ്കാരം! നമ്മുടെ അടുത്ത പ്രസന്റർ ${speakerName} ആണ്, "${topic}" എന്ന വിഷയത്തെക്കുറിച്ച് സംസാരിക്കും. നിങ്ങൾക്ക് ${duration} മിനിറ്റ് സമയമുണ്ട്. തയ്യാറാകുമ്പോൾ ആരംഭിക്കുക.`,
      'ta-IN': `அனைவருக்கும் வணக்கம்! எங்கள் அடுத்த வழங்குநர் ${speakerName}, "${topic}" பற்றி பேசுவார். உங்களுக்கு ${duration} நிமிடங்கள் உள்ளன. தயாரானதும் தொடங்கவும்.`
    };
    
    return scripts[language] || scripts['en-US'];
  }
  
  generateTimeWarningScript(scheduleItem, timeLeft, language) {
    const { speakerName } = scheduleItem;
    
    const scripts = {
      'en-US': `${speakerName}, you have ${timeLeft} minutes remaining. Please wrap up soon.`,
      'hi-IN': `${speakerName}, आपके पास ${timeLeft} मिनट बचे हैं। कृपया जल्दी समाप्त करें।`,
      'ml-IN': `${speakerName}, നിങ്ങൾക്ക് ${timeLeft} മിനിറ്റ് മാത്രമേ ബാക്കിയുള്ളൂ. ദയവായി വേഗത്തിൽ അവസാനിപ്പിക്കുക.`,
      'ta-IN': `${speakerName}, உங்களுக்கு ${timeLeft} நிமிடங்கள் மட்டுமே உள்ளன. விரைவில் முடிக்கவும்.`
    };
    
    return scripts[language] || scripts['en-US'];
  }
  
  generateTransitionScript(completedSpeaker, nextSpeaker, language) {
    const scripts = {
      'en-US': `Thank you ${completedSpeaker.speakerName} for that wonderful presentation. Now, let's welcome ${nextSpeaker.speakerName} who will speak on "${nextSpeaker.topic}".`,
      'hi-IN': `${completedSpeaker.speakerName} जी को उनके शानदार प्रस्तुति के लिए धन्यवाद। अब, ${nextSpeaker.speakerName} का स्वागत करते हैं जो "${nextSpeaker.topic}" पर बोलेंगे।`,
      'ml-IN': `അത്ഭുതകരമായ പ്രസന്റേഷനുവേണ്ടി ${completedSpeaker.speakerName}-ന് നന്ദി. ഇപ്പോൾ, "${nextSpeaker.topic}" എന്ന വിഷയത്തിൽ സംസാരിക്കുന്ന ${nextSpeaker.speakerName}-യെ സ്വാഗതം ചെയ്യാം.`,
      'ta-IN': `அற்புதமான விளக்கத்திற்காக ${completedSpeaker.speakerName}-க்கு நன்றி. இப்போது, "${nextSpeaker.topic}" பற்றி பேசும் ${nextSpeaker.speakerName}-ஐ வரவேற்கலாம்.`
    };
    
    return scripts[language] || scripts['en-US'];
  }
  
  generateClosingScript(meetingTitle, language) {
    const scripts = {
      'en-US': `That concludes our session "${meetingTitle}". Thank you all for your participation. Have a wonderful day!`,
      'hi-IN': `इसके साथ हमारा "${meetingTitle}" सत्र समाप्त होता है। आप सभी के भागीदारी के लिए धन्यवाद। शुभ दिन!`,
      'ml-IN': `ഇതോടെ ഞങ്ങളുടെ "${meetingTitle}" സെഷൻ അവസാനിക്കുന്നു. എല്ലാവരുടെയും പങ്കാളിത്തത്തിന് നന്ദി. നല്ല ദിവസം ആശംസിക്കുന്നു!`,
      'ta-IN': `இதோடு எங்கள் "${meetingTitle}" அமர்வு முடிகிறது. அனைவரின் பங்கேற்புக்கும் நன்றி. இனிய நாள்!`
    };
    
    return scripts[language] || scripts['en-US'];
  }
}

const scriptGenerator = new AIScriptGenerator();

// TTS function using Sarvam AI
async function generateTTS(text, language) {
  try {
    const sarvamLang = languageMapping[language] || 'en-IN';
    console.log('Generating TTS:', { text, language: sarvamLang });

    if (!client) {
      throw new Error("SARVAM_API_KEY is not configured");
    }
    
    const ttsResponse = await withTimeout(
      client.textToSpeech.convert({
        text: text,
        target_language_code: sarvamLang,
        /* The non-streaming endpoint returns base64 WAV by default.
           Requesting WAV explicitly keeps the client MIME handling honest. */
        output_audio_codec: 'wav'
      }),
      20000,
      'Sarvam TTS'
    );
    
    const base64Audio = ttsResponse?.audio || ttsResponse?.data || ttsResponse?.audios?.[0];
    console.log('Generated base64 audio:', !!base64Audio);
    return base64Audio;
  } catch (error) {
    console.error('TTS Error:', error.message);
    return null;
  }
}

// Anchoring Session Manager
class AnchoringSession {
  constructor(roomId, creatorId, settings) {
    this.roomId = roomId;
    this.creatorId = creatorId;
    this.settings = settings;
    this.schedule = Array.isArray(settings.schedule) ? settings.schedule : [];
    this.currentIndex = -1;
    this.isActive = false;
    this.currentSpeaker = null;
    this.timerInterval = null;
    this.isTimerRunning = false;
    this.timeRemaining = 0;
    this.isEnding = false;
    this.language = normalizeAnchorLanguage(settings.language);
    /* Serialize script generation/emission so a skip or timer warning
       cannot overtake the introduction that is still being spoken. */
    this.speechQueue = Promise.resolve();
  }
  
  async start(io) {
    if (!Array.isArray(this.schedule) || this.schedule.length === 0) {
      io.to(this.roomId).emit('anchoring-error', {
        message: 'Add at least one speaker before starting AI anchoring.',
      });
      return;
    }

    this.isActive = true;
    this.currentIndex = 0;
    
    // Notify all participants that anchoring has started
    io.to(this.roomId).emit('anchoring-started', {
      schedule: this.schedule,
      currentIndex: this.currentIndex
    });
    
    // Start first speaker
    await this.moveToNextSpeaker(io);
  }
  
  async moveToNextSpeaker(io) {
    if (this.currentIndex >= this.schedule.length) {
      await this.endSession(io);
      return;
    }
    
    this.currentSpeaker = this.schedule[this.currentIndex];
    this.timeRemaining = this.currentSpeaker.duration * 60; // Convert to seconds
    
    // Generate introduction script
    const introScript = scriptGenerator.generateIntroductionScript(
      this.currentSpeaker, 
      this.language
    );
    
    // Speak the introduction
    await this.speakScript(introScript, io);
    
    // Notify room about speaker change
    io.to(this.roomId).emit('speaker-changed', {
      currentSpeaker: this.currentSpeaker,
      currentIndex: this.currentIndex,
      totalSpeakers: this.schedule.length,
      timeRemaining: this.timeRemaining,
      timestamp: Date.now(),
      serverTime: new Date().toISOString()
    });
    
    // Unmute current speaker and mute others
    io.to(this.roomId).emit('anchoring-control', {
      action: 'unmute-speaker',
      speakerId: this.currentSpeaker.userId,
      speakerName: this.currentSpeaker.speakerName
    });
    
    // Start timer
    this.startTimer(io);
  }
  
  startTimer(io) {
    /* Always replace the previous interval. The old `isTimerRunning`
       guard combined with skip/time-up paths left the flag stuck at
       true, so later speakers never received a countdown. */
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.isTimerRunning = true;
    
    this.timerInterval = setInterval(async () => {
      if (!this.isActive || this.timeRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.isTimerRunning = false;
        return;
      }
      
      this.timeRemaining--;
      
      // Emit time update with synchronized timestamp (throttled)
      if (this.timeRemaining % 1 === 0) { // Only update every second
        io.to(this.roomId).emit('time-update', {
          timeRemaining: this.timeRemaining,
          currentSpeaker: this.currentSpeaker,
          timestamp: Date.now(),
          serverTime: new Date().toISOString()
        });
      }
      
      // Time warnings
      if (this.timeRemaining === 60) {
        const warningScript = scriptGenerator.generateTimeWarningScript(
          this.currentSpeaker, 
          1, 
          this.language
        );
        await this.speakScript(warningScript, io);
      } else if (this.timeRemaining === 30) {
        const warningScript = scriptGenerator.generateTimeWarningScript(
          this.currentSpeaker, 
          0.5, 
          this.language
        );
        await this.speakScript(warningScript, io);
      } else if (this.timeRemaining <= 0) {
        // Time's up - mute speaker and move to next
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.isTimerRunning = false;
        
        io.to(this.roomId).emit('anchoring-control', {
          action: 'mute-speaker',
          speakerId: this.currentSpeaker.userId,
          message: 'Time is up'
        });
        
        // Generate transition to next speaker
        const nextIndex = this.currentIndex + 1;
        if (nextIndex < this.schedule.length) {
          const nextSpeaker = this.schedule[nextIndex];
          const transitionScript = scriptGenerator.generateTransitionScript(
            this.currentSpeaker,
            nextSpeaker,
            this.language
          );
          await this.speakScript(transitionScript, io);
        }
        
        this.currentIndex++;
        await this.moveToNextSpeaker(io);
      }
    }, 1000);
  }
  
  async speakScript(script, io) {
    const task = this.speechQueue
      .catch(() => {})
      .then(() => this.performSpeakScript(script, io));

    this.speechQueue = task;
    return task;
  }

  async performSpeakScript(script, io) {
    const timestamp = new Date().toISOString();
    const messageId = `${this.roomId}:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const announce = () => {
      /* This overlay is deliberately in the meeting language. Per-user
         translated text and audio are delivered separately below. */
      io.to(this.roomId).emit('anchor-announcement', {
        script,
        audioUrl: null,
        language: this.language,
        speakerName: 'AI Anchor',
        timestamp,
        messageId,
      });
    };

    try {
      // Get all users in the room with their language preferences
      const roomUsers = userLanguages.get(this.roomId) || [];
      console.log('Room users for translation:', roomUsers.length, 'users');

      if (roomUsers.length === 0) {
        // Send original script with TTS to all
        const audio = await generateTTS(script, this.language);

        io.to(this.roomId).emit('anchor-tts', {
          script,
          audio,
          language: this.language,
          speakerName: 'AI Anchor',
          timestamp,
          messageId,
          ttsProvider: audio ? 'sarvam' : null,
        });

        announce();
        return;
      }

      // Translate and generate TTS for each user
      const translationPromises = roomUsers.map(async (user) => {
        try {
          // Get the target language code
          const targetLang = normalizeAnchorLanguage(user.language);

          // Translate script if different from meeting language
          let translatedScript = script;
          let spokenLanguage = this.language;

          if (targetLang !== this.language) {
            try {
              const translation = await translate(script, {
                to: targetLang.split('-')[0],
                from: this.language.split('-')[0],
              });

              if (translation?.text) {
                translatedScript = translation.text;
                spokenLanguage = targetLang;
                console.log(
                  `Translated for user ${user.userId}: ${translatedScript}`
                );
              }
            } catch (translationError) {
              console.error(
                `Error translating for user ${user.userId}:`,
                translationError.message
              );
            }
          }

          // Generate TTS in the language that was actually emitted
          const audio = await generateTTS(translatedScript, spokenLanguage);

          return {
            user,
            translatedScript,
            audio,
            language: spokenLanguage,
          };
        } catch (error) {
          console.error(
            `Error translating for user ${user.userId}:`,
            error.message
          );

          // Fallback to original text and original language so the
          // browser fallback does not speak English with a Malayalam voice.
          const audio = await generateTTS(script, this.language);

          return {
            user,
            translatedScript: script,
            audio,
            language: this.language,
          };
        }
      });

      const translations = await Promise.all(translationPromises);

      // Send personalized TTS to each user
      translations.forEach(({ user, translatedScript, audio, language }) => {
        const targetSocket = io.sockets.sockets.get(user.socketId);

        if (targetSocket) {
          targetSocket.emit('anchor-tts', {
            script: translatedScript,
            audio,
            language,
            speakerName: 'AI Anchor',
            timestamp,
            messageId,
            ttsProvider: audio ? 'sarvam' : null,
          });
          console.log(
            `Sent TTS to user ${user.userId} in ${language} (${audio ? 'Sarvam audio' : 'browser fallback'})`
          );
        }
      });

      // Always send the script as an announcement for captions, even
      // when no personalized audio could be produced.
      announce();
    } catch (error) {
      console.error('Error speaking script:', error);
      announce();
    }
  }
  
  async endSession(io) {
    if (this.isEnding) return;

    this.isEnding = true;
    this.isActive = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.isTimerRunning = false;
    
    // Generate closing script
    const closingScript = scriptGenerator.generateClosingScript(
      this.settings.meetingTitle || 'Meeting',
      this.language
    );
    await this.speakScript(closingScript, io);
    
    const completedIndex = this.currentIndex;

    io.to(this.roomId).emit('anchoring-ended', {
      message: 'Anchoring session completed',
      currentIndex: completedIndex,
    });

    this.currentSpeaker = null;
    this.currentIndex = this.schedule.length;
    this.timeRemaining = 0;
    this.isEnding = false;

    /* Keep the session in the map so restart/skip/status continue to
       work after Stop. Enabling anchoring again replaces it. */
  }
  
  pause() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.isActive = false;
    this.isTimerRunning = false;
  }
  
  resume(io) {
    this.isActive = true;
    this.isTimerRunning = false;
    this.startTimer(io);
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected to anchoring service:', socket.id);
  
  // Enable anchoring for a meeting
  socket.on('enable-anchoring', ({ roomId, creatorId, settings = {} } = {}) => {
    if (!roomId) {
      console.error('enable-anchoring requires a roomId');
      socket.emit('anchoring-error', {
        message: 'Cannot enable AI anchoring without a meeting id.',
      });
      return;
    }

    console.log('Enabling anchoring for room:', roomId);

    /* Enabling again must replace the prior session, not leave its
       interval running and producing duplicate announcements. */
    const existingSession = anchoringSessions.get(roomId);
    if (existingSession) {
      if (existingSession.timerInterval) {
        clearInterval(existingSession.timerInterval);
        existingSession.timerInterval = null;
      }
      existingSession.isActive = false;
      existingSession.isTimerRunning = false;
    }

    const normalizedSettings = {
      ...settings,
      schedule: Array.isArray(settings.schedule) ? settings.schedule : [],
    };
    const session = new AnchoringSession(roomId, creatorId, normalizedSettings);
    anchoringSessions.set(roomId, session);
    
    socket.join(roomId);
    
    io.to(roomId).emit('anchoring-enabled', {
      roomId,
      schedule: session.schedule,
      language: session.language,
      creatorId
    });
  });
  
  const notifyAnchoringError = (roomId, message) => {
    console.error('Anchoring error:', message, { roomId });
    if (roomId) {
      io.to(roomId).emit('anchoring-error', { message });
    } else {
      socket.emit('anchoring-error', { message });
    }
  };

  // Start anchoring session
  socket.on('start-anchoring', async ({ roomId } = {}) => {
    console.log('Received start-anchoring event for room:', roomId);
    const session = anchoringSessions.get(roomId);

    if (!session) {
      notifyAnchoringError(
        roomId,
        'AI anchoring has not been enabled for this meeting yet.'
      );
      return;
    }

    if (session.isActive) {
      console.log('Anchoring is already active for room:', roomId);
      return;
    }

    console.log('Starting anchoring session...');
    await session.start(io);
  });
  
  // Pause anchoring
  socket.on('pause-anchoring', ({ roomId } = {}) => {
    const session = anchoringSessions.get(roomId);
    if (!session || !session.isActive) return;

    session.pause();
    io.to(roomId).emit('anchoring-paused');
  });
  
  // Resume anchoring
  socket.on('resume-anchoring', async ({ roomId } = {}) => {
    const session = anchoringSessions.get(roomId);

    if (!session) {
      notifyAnchoringError(roomId, 'There is no anchoring session to resume.');
      return;
    }

    /* After Stop or a completed session there is no current speaker.
       Resume then means starting the schedule from the beginning. */
    if (!session.currentSpeaker) {
      await session.start(io);
      return;
    }

    session.resume(io);
    io.to(roomId).emit('anchoring-resumed');
  });
  
  // Skip to next speaker
  socket.on('skip-speaker', async ({ roomId } = {}) => {
    const session = anchoringSessions.get(roomId);
    if (!session || !session.isActive) return;

    if (session.timerInterval) clearInterval(session.timerInterval);
    session.timerInterval = null;
    session.isTimerRunning = false;
    session.currentIndex++;
    await session.moveToNextSpeaker(io);
  });
  
  // Stop anchoring
  socket.on('stop-anchoring', async ({ roomId } = {}) => {
    const session = anchoringSessions.get(roomId);
    if (!session) return;

    if (!session.isActive && !session.currentSpeaker) {
      return;
    }

    await session.endSession(io);
  });
  
  // Reset anchoring (clear stuck sessions)
  socket.on('reset-anchoring', ({ roomId } = {}) => {
    console.log('Resetting anchoring for room:', roomId);
    const session = anchoringSessions.get(roomId);

    if (session) {
      if (session.timerInterval) clearInterval(session.timerInterval);
      session.timerInterval = null;
      session.isTimerRunning = false;
      session.isActive = false;
      session.currentIndex = 0;
      session.timeRemaining = 0;
      session.currentSpeaker = null;
    }

    io.to(roomId).emit('anchoring-reset', {
      timestamp: Date.now(),
      serverTime: new Date().toISOString()
    });
  });

  // Restart anchoring from beginning
  socket.on('restart-anchoring', async ({ roomId } = {}) => {
    console.log('Restarting anchoring for room:', roomId);
    const session = anchoringSessions.get(roomId);

    if (!session) {
      notifyAnchoringError(
        roomId,
        'There is no anchoring session to restart. Enable anchoring first.'
      );
      return;
    }

    if (!Array.isArray(session.schedule) || session.schedule.length === 0) {
      notifyAnchoringError(
        roomId,
        'Add at least one speaker before restarting AI anchoring.'
      );
      return;
    }

    if (session.timerInterval) clearInterval(session.timerInterval);
    session.timerInterval = null;
    session.isTimerRunning = false;
    session.currentIndex = 0;
    session.timeRemaining = 0;
    session.currentSpeaker = null;
    session.isActive = true;

    // Notify all participants about restart
    io.to(roomId).emit('anchoring-restarted', {
      timestamp: Date.now(),
      serverTime: new Date().toISOString()
    });

    // Start from first speaker
    await session.moveToNextSpeaker(io);
  });

  // Update the speaker schedule without losing the session
  socket.on('update-schedule', ({ roomId, schedule } = {}) => {
    const session = anchoringSessions.get(roomId);

    if (!session || !Array.isArray(schedule)) {
      notifyAnchoringError(
        roomId,
        'Could not update the anchoring schedule because the session or schedule is missing.'
      );
      return;
    }

    session.schedule = schedule;
    session.settings.schedule = schedule;

    io.to(roomId).emit('anchoring-schedule-updated', {
      schedule,
      timestamp: Date.now(),
    });

    console.log('Updated anchoring schedule for room:', roomId, schedule.length, 'speakers');
  });
  
  // Get anchoring status
  socket.on('get-anchoring-status', ({ roomId } = {}, callback) => {
    if (typeof callback !== 'function') return;

    const session = anchoringSessions.get(roomId);

    if (session) {
      callback({
        isActive: session.isActive,
        isAnchoringEnabled: true,
        currentSpeaker: session.currentSpeaker,
        currentIndex: session.currentIndex,
        schedule: session.schedule,
        timeRemaining: session.timeRemaining
      });
    } else {
      callback({ 
        isActive: false,
        isAnchoringEnabled: false
      });
    }
  });
  
  // Join anchoring room with language preference
  socket.on('join-anchoring-room', ({ roomId, userId, language } = {}) => {
    if (!roomId || !userId) {
      console.error('join-anchoring-room requires roomId and userId', {
        roomId,
        userId,
      });
      return;
    }

    socket.join(roomId);
    console.log('Client joined anchoring room:', roomId, 'with language:', language);
    
    // Store user language preference
    if (!userLanguages.has(roomId)) {
      userLanguages.set(roomId, []);
    }
    const roomUsers = userLanguages.get(roomId);
    const normalizedLanguage = normalizeAnchorLanguage(language);
    const duplicateIndex = roomUsers.findIndex(
      (user) => user.socketId === socket.id && user.userId !== userId
    );
    if (duplicateIndex !== -1) roomUsers.splice(duplicateIndex, 1);

    const existingUser = roomUsers.find(u => u.userId === userId);
    if (existingUser) {
      existingUser.socketId = socket.id;
      existingUser.language = normalizedLanguage;
    } else {
      roomUsers.push({ userId, socketId: socket.id, language: normalizedLanguage });
    }
  });
  
  // Update user language preference
  socket.on('update-anchor-language', ({ roomId, userId, language }) => {
    const normalizedLanguage = normalizeAnchorLanguage(language);

    if (userLanguages.has(roomId)) {
      const roomUsers = userLanguages.get(roomId);
      const user = roomUsers.find(u => u.userId === userId);
      if (user) {
        user.language = normalizedLanguage;
        console.log('Updated language for user:', userId, 'to:', normalizedLanguage);
      }
    }

    const session = anchoringSessions.get(roomId);
    if (session && session.creatorId === userId) {
      session.language = normalizedLanguage;
      console.log('Updated anchor language for room:', roomId, 'to:', normalizedLanguage);
    }
  });
  
  socket.on('disconnect', () => {
    // Remove user from language tracking
    userLanguages.forEach((roomUsers, roomId) => {
      const index = roomUsers.findIndex(u => u.socketId === socket.id);
      if (index !== -1) {
        roomUsers.splice(index, 1);
      }
    });
    console.log('Client disconnected from anchoring service:', socket.id);
  });
});

// REST API endpoints
app.get('/api/anchoring/status/:roomId', (req, res) => {
  const session = anchoringSessions.get(req.params.roomId);
  if (session) {
    res.json({
      isActive: session.isActive,
      currentSpeaker: session.currentSpeaker,
      currentIndex: session.currentIndex,
      schedule: session.schedule,
      timeRemaining: session.timeRemaining
    });
  } else {
    res.json({ isActive: false });
  }
});

app.post('/api/anchoring/schedule', (req, res) => {
  const { roomId, schedule } = req.body || {};
  const session = anchoringSessions.get(roomId);
  
  if (session && Array.isArray(schedule)) {
    session.schedule = schedule;
    session.settings.schedule = schedule;
    io.to(roomId).emit('anchoring-schedule-updated', {
      schedule,
      timestamp: Date.now(),
    });
    res.json({ success: true, schedule });
  } else {
    res.status(404).json({ error: 'Anchoring session not found or schedule invalid' });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "anchoring",
    sessions: anchoringSessions.size,
    uptime: process.uptime(),
  });
});

const PORT = process.env.PORT || process.env.ANCHORING_PORT || 3002;

const shutdown = (signal) => {
  console.log(`AI Anchoring Service shutting down (${signal})`);
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🎤 AI Anchoring Service running on port ${PORT} (0.0.0.0)`);
});

module.exports = { app, server, io };