// atranslation.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { translate } from "@vitalets/google-translate-api";
import { SarvamAIClient } from "sarvamai";

// 🔑 Set your Sarvam AI API key here
const client = new SarvamAIClient({
  apiSubscriptionKey: "rai3"
});

const app = express();
const server = http.createServer(app);

const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("speech-text", async (data) => {
    const { text, language = "ml-IN" } = data;
    if (!text || text.trim().length < 2) return;

    try {
      // Translate text using Google Translate
      const targetLang = language.split("-")[0]; // "ml-IN" → "ml"
      const res = await translate(text, { to: targetLang });
      const translatedText = res?.text || text;

      // Send translated text for captions
      socket.emit("translated-caption", translatedText);

      // Generate TTS audio using Sarvam AI
      const ttsResponse = await client.textToSpeech.convert({
        text: translatedText,
        target_language_code: language
      });

      const base64Audio = ttsResponse?.audio || ttsResponse?.data || ttsResponse?.audios?.[0];
      if (base64Audio) socket.emit("tts-audio", base64Audio);

    } catch (err) {
      console.error("TTS/Translate error:", err.message);
      socket.emit("translated-caption", text); // fallback
    }
  });

  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

server.listen(5000, () => console.log("Backend running on port 5000"));