const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { translate } = require("@vitalets/google-translate-api");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  socket.on("speech-text", async (text) => {

    if (!text || text.trim().length < 2) return;

    console.log("Received:", text);

    try {
      const res = await translate(text, { to: "ml" });

      if (!res?.text || res.text.trim() === "") return;

      console.log("Translated:", res.text);

      socket.emit("translated-caption", res.text);

    } catch (error) {
      console.error("Translation error:", error.message);

      // fallback
      socket.emit("translated-caption", text);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });

});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});