const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { translate } = require("@vitalets/google-translate-api");
const { SarvamAIClient } = require("sarvamai");

const client = new SarvamAIClient({
  apiSubscriptionKey: "sk_xbi0i64z_BihO9CdiDsUV4O19SnvXf9mO"
});

const app = express();
const server = http.createServer(app);


const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("speech-text", async (text) => {
    if (!text || text.trim().length < 2) return;
    console.log("Received:", text);

    try {
      // 1. Translate to Malayalam
      const res = await translate(text, { to: "ml" });
      if (!res?.text || res.text.trim() === "") return;

      const translatedText = res.text;
      console.log("Translated:", translatedText);

      // 2. Send translated text for caption display
      socket.emit("translated-caption", translatedText);

      // 3. Generate Malayalam TTS audio via Sarvam AI
      // 3. Generate Malayalam TTS using Sarvam SDK
      const ttsResponse = await client.textToSpeech.convert({
        text: translatedText,
        target_language_code: "ml-IN"
      });

      console.log("TTS SDK Response:", ttsResponse);

      // extract audio safely
      const base64Audio =
        ttsResponse?.audio ||
        ttsResponse?.data ||
        ttsResponse?.audios?.[0];

      if (base64Audio) {
        socket.emit("tts-audio", base64Audio);
      }

    } catch (error) {
      console.error("Error:", error.message);
      socket.emit("translated-caption", text); // fallback
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));