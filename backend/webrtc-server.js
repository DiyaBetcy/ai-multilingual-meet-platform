const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

/* The browser client does not send cookies to the signaling server, so
   wildcard origin must not be combined with credentials: true. That
   invalid CORS combination made preflight/upgrade behavior depend on the
   browser. Restrict origins with CLIENT_ORIGIN when deploying. */
const allowedOrigins = (process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN)
  ? (process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN)
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : "*";

const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: false,
};

app.use(cors(corsOptions));

const server = http.createServer(app);

const io = new Server(server, {
  cors: corsOptions,
});

io.engine.on("connection_error", (error) => {
  console.error("Socket.IO connection error:", {
    code: error?.code,
    message: error?.message,
    context: error?.context,
  });
});

const rooms = new Map();
const participants = new Map();

/* Room policy: the host and whether the waiting room is enabled.
   Keyed by roomId and seeded from the host's first join only, so a
   later joiner can never turn the waiting room off. */
const roomConfig = new Map();

function waitingListFor(config) {
  return Array.from(config.waiting.values()).map((p) => ({
    id: p.id,
    userId: p.userId,
    name: p.name,
  }));
}

function broadcastWaitingList(config) {
  const hostSocket = io.sockets.sockets.get(config.hostId);
  if (hostSocket) {
    hostSocket.emit("waiting-participants", waitingListFor(config));
  }
}

function addParticipantToRoom(socket, roomId, participant) {
  socket.join(roomId);
  participants.set(socket.id, participant);

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId).add(socket.id);

  socket.to(roomId).emit("user-joined", participant);

  const allParticipants = Array.from(rooms.get(roomId))
    .map((id) => participants.get(id))
    .filter((p) => p);

  io.to(roomId).emit("participants-list", allParticipants);
  return allParticipants;
}

const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" }
];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, userName, userId, waitingRoom = false } = {}) => {
    if (!roomId) return;

    console.log(`User ${userName} joining room ${roomId}`);

    const existingRoom = rooms.get(roomId);
    const isFirstParticipant = !existingRoom || existingRoom.size === 0;

    let config = roomConfig.get(roomId);

    if (!config || isFirstParticipant) {
      // The first participant hosts the room and owns its policy.
      config = {
  hostId: socket.id,
  waitingRoom: Boolean(waitingRoom),
  waiting: new Map(),
  questions: [],
};
      roomConfig.set(roomId, config);
    }

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

    /* Waiting room: hold anyone who is not the host until admitted.
       Nothing about the participant is broadcast until admission, so
       no peer connection or media can reach the meeting early. */
    if (config.waitingRoom && socket.id !== config.hostId) {
      config.waiting.set(socket.id, participant);

      socket.emit("waiting-for-admission", {
        roomId,
        hostId: config.hostId,
      });

      broadcastWaitingList(config);

      console.log(`${userName} is waiting for admission to ${roomId}`);
      return;
    }

    socket.emit("room-settings", {
      waitingRoom: config.waitingRoom,
      isHost: socket.id === config.hostId,
    });

    addParticipantToRoom(socket, roomId, participant);

    if (config.hostId === socket.id) {
      broadcastWaitingList(config);
    }

    console.log(`Room ${roomId} has ${rooms.get(roomId).size} participants`);
  });

  /* Only the host may admit or reject a waiting participant. */
  socket.on("admit-participant", ({ targetId } = {}) => {
    const host = participants.get(socket.id);
    const config = host && roomConfig.get(host.roomId);

    if (!config || config.hostId !== socket.id) return;

    const waitingParticipant = config.waiting.get(targetId);
    const guestSocket = io.sockets.sockets.get(targetId);

    if (!waitingParticipant || !guestSocket) return;

    config.waiting.delete(targetId);

    guestSocket.emit("admitted", { roomId: host.roomId });
    guestSocket.emit("room-settings", {
      waitingRoom: config.waitingRoom,
      isHost: false,
    });

    addParticipantToRoom(guestSocket, host.roomId, waitingParticipant);
    broadcastWaitingList(config);

    console.log(`${waitingParticipant.name} admitted to ${host.roomId}`);
  });

  socket.on("reject-participant", ({ targetId } = {}) => {
    const host = participants.get(socket.id);
    const config = host && roomConfig.get(host.roomId);

    if (!config || config.hostId !== socket.id) return;

    const waitingParticipant = config.waiting.get(targetId);
    const guestSocket = io.sockets.sockets.get(targetId);

    if (!waitingParticipant) return;

    config.waiting.delete(targetId);

    if (guestSocket) {
      guestSocket.emit("admission-rejected", {
        roomId: host.roomId,
        message: "The host did not admit you to this meeting.",
      });
    }

    broadcastWaitingList(config);
  });

  /* Signaling is only valid between two admitted participants in the
     same room. Without this check a socket could target any other socket
     by ID. */
  const canSignal = (targetId) => {
    const sender = participants.get(socket.id);
    const target = participants.get(targetId);
    return Boolean(
      sender && target && sender.roomId === target.roomId
    );
  };

  socket.on("offer", ({ targetId, offer } = {}) => {
    if (!targetId || !offer || !canSignal(targetId)) return;

    socket.to(targetId).emit("offer", {
      fromId: socket.id,
      offer
    });
  });

  socket.on("answer", ({ targetId, answer } = {}) => {
    if (!targetId || !answer || !canSignal(targetId)) return;

    socket.to(targetId).emit("answer", {
      fromId: socket.id,
      answer
    });
  });

  socket.on("ice-candidate", ({ targetId, candidate } = {}) => {
    if (!targetId || !candidate || !canSignal(targetId)) return;

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

  socket.on("chat-message", (data = {}) => {
    const participant = participants.get(socket.id);
    if (!participant) return;

    const rawText =
      typeof data.message === "string"
        ? data.message
        : typeof data.text === "string"
          ? data.text
          : "";

    const text = rawText.trim().slice(0, 2000);
    if (!text) return;

    const message = {
      id: `${Date.now()}-${socket.id}`,
      userId: socket.id,
      senderId: socket.id,
      userName: participant.name || "Participant",
      sender: participant.name || "Participant",
      message: text,
      text,
      timestamp: new Date().toISOString(),
    };

    // io.to (not socket.to) intentionally echoes to the sender as well;
    // the client does not optimistically append, so this is the single
    // source of truth for every chat message.
    io.to(participant.roomId).emit("chat-message", message);
  });
  
 
  // All admitted participants can submit questions.
  socket.on("submit-question", ({ question } = {}) => {
    const participant = participants.get(socket.id);
    if (!participant || typeof question !== "string") return;

    const text = question.trim();
    if (!text || text.length > 2000) return;

    const config = roomConfig.get(participant.roomId);
    if (!config) return;

    if (!Array.isArray(config.questions)) {
      config.questions = [];
    }

    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: socket.id,
      userName: participant.name || "Participant",
      question: text,
      answer: "",
      answered: false,
      answeredBy: "",
      timestamp: new Date().toISOString(),
    };

    config.questions.push(item);

    // Broadcast the question to everyone in the same meeting.
    io.to(participant.roomId).emit("new-question", item);
  });

  // Every admitted participant can retrieve all questions.
  socket.on("get-questions", () => {
    const participant = participants.get(socket.id);
    if (!participant) return;

    const config = roomConfig.get(participant.roomId);
    if (!config) return;

    socket.emit("qna-questions", config.questions || []);
  });

  // Every admitted participant can answer any question.
  socket.on("answer-question", ({ questionId, answer } = {}) => {
    const participant = participants.get(socket.id);
    if (!participant || !questionId) return;

    const config = roomConfig.get(participant.roomId);
    if (!config) return;

    const item = (config.questions || []).find(
      (question) => question.id === questionId
    );

    if (!item) return;

    if (typeof answer === "string" && answer.trim()) {
      item.answer = answer.trim().slice(0, 2000);
      item.answered = true;
      item.answeredBy = participant.name || "Participant";
    } else {
      item.answered = true;
      item.answeredBy = participant.name || "Participant";
    }

    // Everyone sees the updated answer.
    io.to(participant.roomId).emit("question-updated", item);
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
    /* Remove the socket from any waiting room it was held in. */
    for (const [roomId, config] of roomConfig.entries()) {
      if (config.waiting.delete(socket.id)) {
        broadcastWaitingList(config);
        if (config.waiting.size === 0 && !rooms.has(roomId)) {
          roomConfig.delete(roomId);
        }
        break;
      }
    }

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

      // Broadcast updated participant list to all users for synchronization
      const remainingRoom = rooms.get(participant.roomId);
      if (remainingRoom && remainingRoom.size > 0) {
        const allParticipants = Array.from(remainingRoom)
          .map((id) => participants.get(id))
          .filter((p) => p);
        
        io.to(participant.roomId).emit("participants-list", allParticipants);
      }

      /* If the host left, hand the room to the next participant so the
         waiting room can still be operated. If nobody remains, release
         the waiting guests instead of leaving them stuck forever. */
      const config = roomConfig.get(participant.roomId);

      if (config && config.hostId === socket.id) {
        if (remainingRoom && remainingRoom.size > 0) {
          config.hostId = remainingRoom.values().next().value;
          const newHost = io.sockets.sockets.get(config.hostId);

          if (newHost) {
            newHost.emit("host-changed", { isHost: true });
            newHost.emit("waiting-participants", waitingListFor(config));
          }
        } else {
          config.waiting.forEach((_, waitingId) => {
            const guest = io.sockets.sockets.get(waitingId);
            if (guest) {
              guest.emit("admission-rejected", {
                message: "The meeting has ended.",
              });
            }
          });

          roomConfig.delete(participant.roomId);
        }
      }

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
  res.status(200).json({
    status: "ok",
    service: "webrtc-signaling",
    uptime: process.uptime(),
    rooms: rooms.size,
    connections: io.engine?.clientsCount ?? 0,
  });
});
const PORT = process.env.PORT || process.env.WEBRTC_PORT || 3001;

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `WebRTC signaling cannot start: port ${PORT} is already in use. ` +
        `Another server or a Vite Dev Server may have claimed it. ` +
        `Run: Get-NetTCPConnection -LocalPort ${PORT} -State Listen`
    );
  } else {
    console.error("WebRTC signaling server error:", error);
  }

  process.exitCode = 1;
  process.exit(1);
});

const shutdown = (signal) => {
  console.log(`WebRTC signaling shutting down (${signal})`);
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`WebRTC signaling server running on port ${PORT} (0.0.0.0)`);
});