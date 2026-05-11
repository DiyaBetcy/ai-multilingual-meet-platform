const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const rooms = new Map();
const participants = new Map();

const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" }
];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, userName, userId }) => {
    console.log(`User ${userName} joining room ${roomId}`);

    socket.join(roomId);

    const participant = {
      id: socket.id,
      userId: userId || socket.id,
      name: userName,
      roomId,
      micOn: true,
      camOn: true,
      isScreenSharing: false,
      joinedAt: new Date()
    };

    participants.set(socket.id, participant);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(socket.id);

    socket.to(roomId).emit("user-joined", participant);

    const roomParticipants = Array.from(rooms.get(roomId))
      .map((id) => participants.get(id))
      .filter((p) => p && p.id !== socket.id);

    socket.emit("participants-list", roomParticipants);

    console.log(`Room ${roomId} has ${rooms.get(roomId).size} participants`);
  });

  socket.on("offer", ({ targetId, offer }) => {
    socket.to(targetId).emit("offer", {
      fromId: socket.id,
      offer
    });
  });

  socket.on("answer", ({ targetId, answer }) => {
    socket.to(targetId).emit("answer", {
      fromId: socket.id,
      answer
    });
  });

  socket.on("ice-candidate", ({ targetId, candidate }) => {
    socket.to(targetId).emit("ice-candidate", {
      fromId: socket.id,
      candidate
    });
  });

  socket.on("media-state-change", (data) => {
    const participant = participants.get(socket.id);

    if (participant) {
      participant.micOn = data.micOn ?? participant.micOn;
      participant.camOn = data.camOn ?? participant.camOn;
      participant.isScreenSharing = data.isScreenSharing ?? participant.isScreenSharing;

      socket.to(participant.roomId).emit("media-state-changed", {
        userId: socket.id,
        micOn: participant.micOn,
        camOn: participant.camOn,
        isScreenSharing: participant.isScreenSharing
      });
    }
  });

  socket.on("chat-message", (data) => {
    const participant = participants.get(socket.id);

    if (participant) {
      const message = {
        id: Date.now(),
        userId: socket.id,
        userName: participant.name,
        message: data.message,
        timestamp: new Date()
      };

      io.to(participant.roomId).emit("chat-message", message);
    }
  });

  socket.on("hand-raise", (data) => {
    const participant = participants.get(socket.id);

    if (participant) {
      socket.to(participant.roomId).emit("hand-raise", {
        userId: socket.id,
        raised: data.raised
      });
    }
  });

  socket.on("disconnect", () => {
    const participant = participants.get(socket.id);

    if (participant) {
      const room = rooms.get(participant.roomId);

      if (room) {
        room.delete(socket.id);

        if (room.size === 0) {
          rooms.delete(participant.roomId);
        }
      }

      socket.to(participant.roomId).emit("user-left", {
        userId: socket.id
      });

      participants.delete(socket.id);

      console.log(`User ${participant.name} left room ${participant.roomId}`);
    }
  });
});

app.get("/ice-servers", (req, res) => {
  res.json({ iceServers });
});

app.get("/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  const roomParticipants = Array.from(room)
    .map((id) => participants.get(id))
    .filter((p) => p);

  res.json({
    roomId,
    participantCount: room.size,
    participants: roomParticipants.map((p) => ({
      id: p.id,
      name: p.name,
      micOn: p.micOn,
      camOn: p.camOn,
      isScreenSharing: p.isScreenSharing
    }))
  });
});
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});
const PORT = process.env.PORT || process.env.WEBRTC_PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`WebRTC signaling server running on port ${PORT}`);
});