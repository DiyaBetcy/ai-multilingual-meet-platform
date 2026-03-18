const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fetch = require("node-fetch");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

/* ---------------- TRANSLATION FUNCTION ---------------- */

const translate = async (text, targetLang) => {
  try {
    const res = await fetch("https://translate.argosopentech.com/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: text,
        source: "en",
        target: targetLang,
        format: "text"
      })
    });

    const data = await res.json();

    return data.translatedText;

  } catch (error) {
    console.error("Translation error:", error);
    return text; // fallback (important)
  }
};

/* ---------------- SOCKET ---------------- */

io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  socket.on("speech-text", async (text) => {

    console.log("Received:", text);

    if (!text) return;

    try {
      // currently fixed language (Malayalam)
      const translated = await translate(text, "ml");

      socket.emit("translated-caption", translated);

    } catch (error) {
      console.error("Processing error:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });

});

/* ---------------- SERVER ---------------- */

server.listen(5000, () => {
  console.log("Server running on port 5000");
});