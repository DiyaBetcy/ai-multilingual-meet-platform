const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { translate } = require('@vitalets/google-translate-api');
const { SarvamAIClient } = require('sarvamai');

const app = express();
app.use(cors());
app.use(express.json());

// Sarvam AI Client with correct API key
const client = new SarvamAIClient({ 
  apiSubscriptionKey: "sk_1ku0hjgj_imfH0GRztZnc8CsNWJiJ0lQr" 
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "*"],
    methods: ["GET", "POST"]
  }
});

// Store anchoring sessions
const anchoringSessions = new Map();

// Store user language preferences: roomId -> [{ userId, socketId, language }]
const userLanguages = new Map();

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
  'or-IN': 'or-IN',
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
    
    const ttsResponse = await client.textToSpeech.convert({
      text: text,
      target_language_code: sarvamLang
    });
    
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
    this.schedule = settings.schedule || [];
    this.currentIndex = -1;
    this.isActive = false;
    this.currentSpeaker = null;
    this.timerInterval = null;
    this.isTimerRunning = false;
    this.timeRemaining = 0;
    this.language = settings.language || 'en-US';
  }
  
  async start(io) {
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
    if (this.timerInterval) clearInterval(this.timerInterval);
    
    // Prevent multiple timers
    if (this.isTimerRunning) return;
    this.isTimerRunning = true;
    
    this.timerInterval = setInterval(async () => {
      if (!this.isActive || this.timeRemaining <= 0) {
        clearInterval(this.timerInterval);
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
    try {
      // Get all users in the room with their language preferences
      const roomUsers = userLanguages.get(this.roomId) || [];
      console.log('Room users for translation:', roomUsers.length, 'users');
      
      if (roomUsers.length === 0) {
        // Send original script with TTS to all
        const audioUrl = await generateTTS(script, this.language);
        io.to(this.roomId).emit('anchor-tts', {
          script: script,
          audio: audioUrl,
          language: this.language,
          speakerName: 'AI Anchor',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Translate and generate TTS for each user
      const translationPromises = roomUsers.map(async (user) => {
        try {
          // Get the target language code
          const targetLang = user.language || 'en-US';
          
          // Translate script if different from meeting language
          let translatedScript = script;
          if (targetLang !== this.language) {
            const translation = await translate(script, {
              to: targetLang.split('-')[0],
              from: this.language.split('-')[0]
            });
            translatedScript = translation.text;
            console.log(`Translated for user ${user.userId}: ${translatedScript}`);
          }
          
          // Generate TTS in user's language
          const audioUrl = await generateTTS(translatedScript, targetLang);
          
          return {
            user,
            translatedScript,
            audioUrl
          };
        } catch (error) {
          console.error(`Error translating for user ${user.userId}:`, error.message);
          // Fallback to original
          const audioUrl = await generateTTS(script, this.language);
          return {
            user,
            translatedScript: script,
            audioUrl
          };
        }
      });
      
      const translations = await Promise.all(translationPromises);
      
      // Send personalized TTS to each user
      translations.forEach(({ user, translatedScript, audioUrl }) => {
        const targetSocket = io.sockets.sockets.get(user.socketId);
        if (targetSocket) {
          targetSocket.emit('anchor-tts', {
            script: translatedScript,
            audio: audioUrl,
            language: user.language,
            speakerName: 'AI Anchor',
            timestamp: new Date().toISOString()
          });
          console.log(`Sent TTS to user ${user.userId} in ${user.language}`);
        }
      });
      
      // Also send the script as announcement for captions
      io.to(this.roomId).emit('anchor-announcement', {
        script: script,
        audioUrl: null,
        speakerName: 'AI Anchor',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error speaking script:', error);
      // Still emit the script even if translation fails
      io.to(this.roomId).emit('anchor-announcement', {
        script: script,
        audioUrl: null,
        speakerName: 'AI Anchor',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  async endSession(io) {
    this.isActive = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    
    // Generate closing script
    const closingScript = scriptGenerator.generateClosingScript(
      this.settings.meetingTitle || 'Meeting',
      this.language
    );
    await this.speakScript(closingScript, io);
    
    io.to(this.roomId).emit('anchoring-ended', {
      message: 'Anchoring session completed'
    });
    
    // Clean up
    anchoringSessions.delete(this.roomId);
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
  socket.on('enable-anchoring', ({ roomId, creatorId, settings }) => {
    console.log('Enabling anchoring for room:', roomId);
    
    const session = new AnchoringSession(roomId, creatorId, settings);
    anchoringSessions.set(roomId, session);
    
    socket.join(roomId);
    
    io.to(roomId).emit('anchoring-enabled', {
      roomId,
      schedule: settings.schedule,
      creatorId
    });
  });
  
  // Start anchoring session
  socket.on('start-anchoring', async ({ roomId }) => {
    console.log('Received start-anchoring event for room:', roomId);
    const session = anchoringSessions.get(roomId);
    console.log('Session found:', !!session, 'Session active:', session?.isActive);
    if (session && !session.isActive) {
      console.log('Starting anchoring session...');
      await session.start(io);
    } else {
      console.error('Cannot start anchoring:', { sessionExists: !!session, isActive: session?.isActive });
    }
  });
  
  // Pause anchoring
  socket.on('pause-anchoring', ({ roomId }) => {
    const session = anchoringSessions.get(roomId);
    if (session) {
      session.pause();
      io.to(roomId).emit('anchoring-paused');
    }
  });
  
  // Resume anchoring
  socket.on('resume-anchoring', ({ roomId }) => {
    const session = anchoringSessions.get(roomId);
    if (session) {
      session.resume(io);
      io.to(roomId).emit('anchoring-resumed');
    }
  });
  
  // Skip to next speaker
  socket.on('skip-speaker', async ({ roomId }) => {
    const session = anchoringSessions.get(roomId);
    if (session && session.isActive) {
      clearInterval(session.timerInterval);
      session.currentIndex++;
      await session.moveToNextSpeaker(io);
    }
  });
  
  // Stop anchoring
  socket.on('stop-anchoring', async ({ roomId }) => {
    const session = anchoringSessions.get(roomId);
    if (session) {
      await session.endSession(io);
    }
  });
  
  // Reset anchoring (clear stuck sessions)
  socket.on('reset-anchoring', ({ roomId }) => {
    console.log('Resetting anchoring for room:', roomId);
    const session = anchoringSessions.get(roomId);
    if (session) {
      if (session.timerInterval) clearInterval(session.timerInterval);
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
  socket.on('restart-anchoring', async ({ roomId }) => {
    console.log('Restarting anchoring for room:', roomId);
    const session = anchoringSessions.get(roomId);
    if (session) {
      if (session.timerInterval) clearInterval(session.timerInterval);
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
    }
  });
  
  // Get anchoring status
  socket.on('get-anchoring-status', ({ roomId }, callback) => {
    const session = anchoringSessions.get(roomId);
    if (session) {
      callback({
        isActive: session.isActive,
        isAnchoringEnabled: true, // Always true when session exists
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
  socket.on('join-anchoring-room', ({ roomId, userId, language }) => {
    socket.join(roomId);
    console.log('Client joined anchoring room:', roomId, 'with language:', language);
    
    // Store user language preference
    if (!userLanguages.has(roomId)) {
      userLanguages.set(roomId, []);
    }
    const roomUsers = userLanguages.get(roomId);
    const existingUser = roomUsers.find(u => u.userId === userId);
    if (existingUser) {
      existingUser.socketId = socket.id;
      existingUser.language = language;
    } else {
      roomUsers.push({ userId, socketId: socket.id, language });
    }
  });
  
  // Update user language preference
  socket.on('update-anchor-language', ({ roomId, userId, language }) => {
    if (userLanguages.has(roomId)) {
      const roomUsers = userLanguages.get(roomId);
      const user = roomUsers.find(u => u.userId === userId);
      if (user) {
        user.language = language;
        console.log('Updated language for user:', userId, 'to:', language);
      }
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
  const { roomId, schedule } = req.body;
  const session = anchoringSessions.get(roomId);
  
  if (session) {
    session.schedule = schedule;
    res.json({ success: true, schedule });
  } else {
    res.status(404).json({ error: 'Anchoring session not found' });
  }
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

const PORT = process.env.PORT || process.env.ANCHORING_PORT || 3002;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🎤 AI Anchoring Service running on port ${PORT}`);
});

module.exports = { app, server, io };