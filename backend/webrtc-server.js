const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store active rooms and participants
const rooms = new Map();
const participants = new Map();

// ICE servers configuration
const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" }
];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join meeting room
  socket.on("join-room", (data) => {
    const { roomId, userName, userId } = data;
    console.log(`User ${userName} joining room ${roomId}`);
    
    // Join socket room
    socket.join(roomId);
    
    // Store participant info
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
    
    // Initialize room if doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
      console.log(`Created new room: ${roomId}`);
    }
    rooms.get(roomId).add(socket.id);
    
    console.log(`Room ${roomId} now has ${rooms.get(roomId).size} participants`);
    
    // Notify existing participants
    socket.to(roomId).emit("user-joined", participant);
    
    // Send current participants list to new user
    const roomParticipants = Array.from(rooms.get(roomId))
      .map(id => participants.get(id))
      .filter(p => p && p.id !== socket.id);
    
    console.log("Sending participants list to new user:", roomParticipants);
    socket.emit("participants-list", roomParticipants);
    
    console.log(`User ${userName} joined room ${roomId}`);
  });

  // Handle WebRTC signaling
  socket.on("offer", (data) => {
    const { targetId, offer } = data;
    socket.to(targetId).emit("offer", {
      fromId: socket.id,
      offer
    });
  });

  socket.on("answer", (data) => {
    const { targetId, answer } = data;
    socket.to(targetId).emit("answer", {
      fromId: socket.id,
      answer
    });
  });

  socket.on("ice-candidate", (data) => {
    const { targetId, candidate } = data;
    socket.to(targetId).emit("ice-candidate", {
      fromId: socket.id,
      candidate
    });
  });

  // Handle media state changes
  socket.on("toggle-media", (data) => {
    const participant = participants.get(socket.id);
    if (participant) {
      participant.micOn = data.micOn !== undefined ? data.micOn : participant.micOn;
      participant.camOn = data.camOn !== undefined ? data.camOn : participant.camOn;
      participant.isScreenSharing = data.isScreenSharing !== undefined ? data.isScreenSharing : participant.isScreenSharing;
      
      // Notify other participants
      socket.to(participant.roomId).emit("media-state-changed", {
        userId: socket.id,
        micOn: participant.micOn,
        camOn: participant.camOn,
        isScreenSharing: participant.isScreenSharing
      });
    }
  });

  // Handle chat messages
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
      
      // Send to all participants in room
      io.to(participant.roomId).emit("chat-message", message);
    }
  });

  // Handle hand raise
  socket.on("hand-raise", (data) => {
    const participant = participants.get(socket.id);
    if (participant) {
      socket.to(participant.roomId).emit("hand-raise", {
        userId: socket.id,
        raised: data.raised
      });
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    const participant = participants.get(socket.id);
    if (participant) {
      // Remove from room
      const room = rooms.get(participant.roomId);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) {
          rooms.delete(participant.roomId);
        }
      }
      
      // Notify other participants
      socket.to(participant.roomId).emit("user-left", {
        userId: socket.id
      });
      
      // Clean up
      participants.delete(socket.id);
      
      console.log(`User ${participant.name} left room ${participant.roomId}`);
    }
  });
});

// Get ICE servers configuration
app.get("/ice-servers", (req, res) => {
  res.json({ iceServers });
});

// Get room info
app.get("/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  
  const roomParticipants = Array.from(room)
    .map(id => participants.get(id))
    .filter(p => p);
  
  res.json({
    roomId,
    participantCount: room.size,
    participants: roomParticipants.map(p => ({
      id: p.id,
      name: p.name,
      micOn: p.micOn,
      camOn: p.camOn,
      isScreenSharing: p.isScreenSharing
    }))
  });
});

const PORT = process.env.WEBRTC_PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebRTC signaling server running on port ${PORT}`);
});
