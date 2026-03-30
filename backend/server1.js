// server1.js
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
app.use(cors());
import { exec } from "child_process"; // Or any TTS library

const app = express();
const PORT = 3001;

// Example endpoint
app.get("/api/tts", async (req, res) => {
  const text = req.query.text || "";
  const lang = req.query.lang || "en";

  try {
    // Using gTTS (Google Text-to-Speech) via CLI as example
    // You need to install it: npm i gtts
    const filePath = path.join(__dirname, "output.mp3");
    exec(`gtts-cli "${text}" --lang ${lang} --output "${filePath}"`, (err) => {
      if (err) return res.status(500).send("TTS generation failed");

      res.setHeader("Content-Type", "audio/mpeg");
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("TTS Error");
  }
});

app.listen(PORT, () => console.log(`TTS Server running on port ${PORT}`));