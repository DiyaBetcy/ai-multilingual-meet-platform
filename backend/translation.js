const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { translate } = require("@vitalets/google-translate-api");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

/* ---------------- SOCKET ---------------- */

io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  socket.on("speech-text", async (text) => {

    console.log("Received:", text);

    if (!text) return;

    try {
      const res = await translate(text, { to: "ml" });

      console.log("Translated:", res.text);

      socket.emit("translated-caption", res.text);

    } catch (error) {
      console.error("Translation error:", error.message);

      // fallback (IMPORTANT)
      socket.emit("translated-caption", text);
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