const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { translate } = require("@vitalets/google-translate-api");
const { SarvamAIClient } = require("sarvamai");
const cors = require("cors");

const client = new SarvamAIClient({
  apiSubscriptionKey: "sk_xbi0i64z_BihO9CdiDsUV4O19SnvXf9mO"
});

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, { 
  cors: { 
    origin: ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true
  } 
});

// Store user language preferences: userId -> { socketId, language, name, roomId }
const userLanguages = new Map();

// Language code mapping for Sarvam AI TTS
const languageCodeMap = {
  'en': 'en-IN',
  'ml': 'ml-IN',
  'hi': 'hi-IN',
  'ta': 'ta-IN',
  'te': 'te-IN',
  'kn': 'kn-IN',
  'bn': 'bn-IN',
  'gu': 'gu-IN',
  'mr': 'mr-IN',
  'od': 'od-IN',
  'pa': 'pa-IN',
  'as': 'as-IN',
  'ur': 'ur-IN'
};

// Language names for display
const languageNames = {
  'en': 'English',
  'ml': 'Malayalam',
  'hi': 'Hindi',
  'ta': 'Tamil',
  'te': 'Telugu',
  'kn': 'Kannada',
  'bn': 'Bengali',
  'gu': 'Gujarati',
  'mr': 'Marathi',
  'od': 'Odia',
  'pa': 'Punjabi',
  'as': 'Assamese',
  'ur': 'Urdu'
};

io.on("connection", (socket) => {
  console.log("✅ Translation user connected:", socket.id);

  // User joins with their preferred language
  socket.on("join-translation", ({ userId, userName, roomId, preferredLanguage }) => {
    console.log(`🌍 User ${userName} (${userId}) joined room ${roomId} with language: ${preferredLanguage || 'en'}`);
    
    userLanguages.set(userId, {
      socketId: socket.id,
      language: preferredLanguage || 'en',
      name: userName,
      roomId: roomId,
      userId: userId
    });
    
    socket.join(roomId);
    
    // Notify user of successful join
    socket.emit("translation-joined", {
      userId,
      language: preferredLanguage || 'en',
      languageName: languageNames[preferredLanguage || 'en']
    });
  });

  // Change language preference
  socket.on("change-language", ({ userId, newLanguage }) => {
    const user = userLanguages.get(userId);
    if (user) {
      user.language = newLanguage;
      console.log(`🔄 User ${user.name} changed language to: ${newLanguage}`);
      socket.emit("language-changed", {
        language: newLanguage,
        languageName: languageNames[newLanguage]
      });
    }
  });

  // Handle incoming speech text from a user
  socket.on("speech-text", async ({ userId, text, originalLanguage }) => {
    if (!text || text.trim().length < 2) return;
    
    const speaker = userLanguages.get(userId);
    if (!speaker) {
      console.error("❌ Speaker not found:", userId);
      return;
    }
    
    console.log(`🎤 ${speaker.name} (${speaker.roomId}): "${text}"`);
    
    try {
      // Get all users in the same room
      const roomUsers = Array.from(userLanguages.values()).filter(u => u.roomId === speaker.roomId);
      console.log(`👥 Room ${speaker.roomId} has ${roomUsers.length} users with languages:`, 
        roomUsers.map(u => `${u.name}:${u.language}`).join(', '));
      
      // Send original text to speaker (for their own caption)
      socket.emit("translated-caption", {
        speaker: speaker.name,
        text: text,
        translatedText: text,
        targetLanguage: speaker.language,
        isOriginal: true
      });
      
      // Translate to each user's preferred language
      const translationPromises = roomUsers
        .filter(user => user.userId !== userId) // Don't re-translate for speaker
        .map(async (targetUser) => {
          try {
            if (targetUser.language === (originalLanguage || 'en')) {
              // Same language - no translation needed
              return {
                targetUser,
                translatedText: text,
                audio: null
              };
            }
            
            // Translate to target user's language
            const translation = await translate(text, { 
              to: targetUser.language,
              from: originalLanguage || 'en'
            });
            
            const translatedText = translation.text;
            console.log(`🔄 Translated for ${targetUser.name}: "${translatedText}"`);
            
            // Generate TTS for target user's language
            const ttsResponse = await client.textToSpeech.convert({
              text: translatedText,
              target_language_code: languageCodeMap[targetUser.language] || 'en-IN'
            });
            
            const base64Audio = ttsResponse?.audio || ttsResponse?.data || ttsResponse?.audios?.[0];
            
            return {
              targetUser,
              translatedText,
              audio: base64Audio
            };
          } catch (error) {
            console.error(`❌ Error translating for ${targetUser.name}:`, error.message);
            return {
              targetUser,
              translatedText: text, // fallback
              audio: null
            };
          }
        });
      
      // Wait for all translations
      const translations = await Promise.all(translationPromises);
      
      // Send translated content to each user
      translations.forEach(({ targetUser, translatedText, audio }) => {
        const targetSocket = io.sockets.sockets.get(targetUser.socketId);
        if (targetSocket) {
          // Send translated caption
          targetSocket.emit("translated-caption", {
            speaker: speaker.name,
            text: text,
            translatedText: translatedText,
            targetLanguage: targetUser.language,
            isOriginal: false
          });
          
          // Send TTS audio if available
          if (audio) {
            targetSocket.emit("tts-audio", {
              speaker: speaker.name,
              audio: audio,
              language: targetUser.language
            });
            console.log(`🔊 Sent TTS to ${targetUser.name} in ${targetUser.language}`);
          }
        }
      });
      
    } catch (error) {
      console.error("❌ Translation error:", error.message);
      // Fallback: send original text to all
      socket.to(speaker.roomId).emit("translated-caption", {
        speaker: speaker.name,
        text: text,
        translatedText: text,
        error: "Translation failed"
      });
    }
  });

  // Get available languages
  socket.on("get-languages", () => {
    socket.emit("available-languages", languageNames);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("❌ Translation user disconnected:", socket.id);
    // Find and remove user
    for (const [userId, user] of userLanguages.entries()) {
      if (user.socketId === socket.id) {
        console.log(`👋 Removed user ${user.name} from translation service`);
        userLanguages.delete(userId);
        break;
      }
    }
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    activeUsers: userLanguages.size,
    users: Array.from(userLanguages.values()).map(u => ({
      name: u.name,
      language: u.language,
      room: u.roomId
    }))
  });
});

server.listen(5000, () => console.log("🌐 Translation Server running on port 5000"));
