import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
<<<<<<< HEAD
import bcrypt from "bcryptjs";
import http from "http";
import { Server } from "socket.io";

import Otp from "./models/Otp.js";
import User from "./models/User.js";
=======
import Otp from "./models/Otp.js";
import User from "./models/User.js";
import bcrypt from "bcryptjs";
import http from "http";
import { Server } from "socket.io";
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

/* ---------------- CORS ---------------- */

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const corsOptions = {
<<<<<<< HEAD
  origin: FRONTEND_URL,
=======
  origin: allowedOrigins,
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());

<<<<<<< HEAD
/* ---------------- HTTP + SOCKET SERVER ---------------- */

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

/* ---------------- MONGODB ---------------- */

const MONGO_URI = process.env.MONGO_URI;

console.log("FRONTEND_URL:", FRONTEND_URL);
console.log("MONGO_URI loaded:", !!MONGO_URI);
console.log("EMAIL_USER loaded:", !!process.env.EMAIL_USER);

if (!MONGO_URI) {
  console.error("MONGO_URI is missing in backend/.env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

/* ---------------- TEST ROUTE ---------------- */
=======
// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e

app.get("/", (req, res) => {
  res.send("Backend is working 🚀");
});

<<<<<<< HEAD
/* ---------------- OTP HELPERS ---------------- */

const generateOTP = () => Math.floor(100000 + Math.random() * 900000);

/* ---------------- OTP ROUTES ---------------- */

app.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(500).json({
      message: "Email credentials are missing in backend/.env",
    });
  }

  const otp = generateOTP();

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP for AI Meet Platform",
    text: `Your OTP is: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP ${otp} sent to ${email}`);

    const otpDoc = new Otp({ email, otp });
    await otpDoc.save();

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("send-otp error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
});

app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }
=======
// OTP + Signup routes (keep your existing routes here)

// ------------------ SOCKET.IO ------------------
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

// roomId -> [{ id, name }]
const rooms = {};
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

<<<<<<< HEAD
    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid OTP or expired" });
    }

    await Otp.deleteOne({ _id: otpRecord._id });

    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (err) {
    console.error("verify-otp error:", err);
    return res.status(500).json({ message: "Verification failed" });
  }
});

/* ---------------- SIGNUP ROUTE ---------------- */

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const existing = await User.findOne({ email });

    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashed,
      isVerified: true,
    });

    return res.status(201).json({
      message: "Account created successfully",
      userId: user._id,
    });
  } catch (err) {
    console.error("signup error:", err);
    return res.status(500).json({ message: "Signup failed" });
  }
});

/* ---------------- IN-MEMORY ROOM STORE ---------------- */
/*
rooms = {
  [meetingId]: {
    meetingId,
    hostId,
    password,
    waitingRoom,
    aiAnchor,
    createdAt,
    participants: {
      [socketId]: {
        socketId,
        name,
        isHost,
        micOn,
        camOn,
        handRaised,
        isSharing,
        preferredLanguage
      }
    }
  }
}
*/

const rooms = {};
const socketToRoom = {};

/* ---------------- ROOM HELPERS ---------------- */

function getRoomParticipantsArray(meetingId) {
  const room = rooms[meetingId];
  if (!room) return [];
  return Object.values(room.participants);
}

function createRoomIfNeeded({
  meetingId,
  socketId,
  hostName = "Host",
  password = "",
  waitingRoom = false,
  aiAnchor = false,
  micOn = true,
  camOn = true,
  preferredLanguage = "en-US",
}) {
  if (rooms[meetingId]) return rooms[meetingId];

  rooms[meetingId] = {
    meetingId,
    hostId: socketId,
    password,
    waitingRoom,
    aiAnchor,
    createdAt: new Date(),
    participants: {
      [socketId]: {
        socketId,
        name: hostName,
        isHost: true,
        micOn,
        camOn,
        handRaised: false,
        isSharing: false,
        preferredLanguage,
      },
    },
  };

  socketToRoom[socketId] = meetingId;
  return rooms[meetingId];
}

function removeParticipantFromRoom(socketId) {
  const meetingId = socketToRoom[socketId];
  if (!meetingId) return null;

  const room = rooms[meetingId];
  if (!room) {
    delete socketToRoom[socketId];
    return null;
  }

  const leavingParticipant = room.participants[socketId];
  delete room.participants[socketId];
  delete socketToRoom[socketId];

  const remainingParticipants = Object.values(room.participants);

  if (remainingParticipants.length === 0) {
    delete rooms[meetingId];
    return {
      meetingId,
      removedSocketId: socketId,
      roomDeleted: true,
      leavingParticipant,
    };
  }

  if (room.hostId === socketId) {
    const newHost = remainingParticipants[0];
    room.hostId = newHost.socketId;
    room.participants[newHost.socketId].isHost = true;
  }

  return {
    meetingId,
    removedSocketId: socketId,
    roomDeleted: false,
    leavingParticipant,
  };
}

/* ---------------- SOCKET.IO ---------------- */

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  /* ---------- CREATE ROOM ---------- */
  socket.on("create-room", (payload = {}, callback) => {
    try {
      const {
        meetingId,
        password = "",
        waitingRoom = false,
        aiAnchor = false,
        hostName = "Host",
        micOn = true,
        camOn = true,
        preferredLanguage = "en-US",
      } = payload;

      if (!meetingId) {
        if (callback) callback({ ok: false, message: "Meeting ID is required" });
        return;
      }

      if (rooms[meetingId]) {
        if (callback) callback({ ok: false, message: "Meeting ID already exists" });
        return;
      }

      const room = createRoomIfNeeded({
        meetingId,
        socketId: socket.id,
        hostName,
        password,
        waitingRoom,
        aiAnchor,
        micOn,
        camOn,
        preferredLanguage,
      });

      socket.join(meetingId);

      const users = getRoomParticipantsArray(meetingId);

      if (callback) {
        callback({
          ok: true,
          message: "Room created successfully",
          room: {
            meetingId: room.meetingId,
            hostId: room.hostId,
            waitingRoom: room.waitingRoom,
            aiAnchor: room.aiAnchor,
          },
          users,
          selfSocketId: socket.id,
        });
      }

      io.to(meetingId).emit("room-users", users);

      console.log(`Room created: ${meetingId} by ${socket.id}`);
      console.log(
        "Room users now:",
        meetingId,
        getRoomParticipantsArray(meetingId).map((u) => ({
          socketId: u.socketId,
          name: u.name,
          isHost: u.isHost,
        }))
      );
      console.log(`Broadcasted room-users to ${meetingId}:`, users.length);
    } catch (err) {
      console.error("create-room error:", err);
      if (callback) callback({ ok: false, message: "Failed to create room" });
    }
  });

  /* ---------- JOIN ROOM ---------- */
  socket.on("join-room", (payload = {}, callback) => {
    try {
      const {
        meetingId,
        password = "",
        name = "Guest",
        micOn = true,
        camOn = true,
        preferredLanguage = "en-US",
        createIfMissing = false,
        waitingRoom = false,
        aiAnchor = false,
      } = payload;

      if (!meetingId) {
        if (callback) callback({ ok: false, message: "Meeting ID is required" });
        return;
      }

      let room = rooms[meetingId];

      if (!room && createIfMissing) {
        room = createRoomIfNeeded({
          meetingId,
          socketId: socket.id,
          hostName: name,
          password,
          waitingRoom,
          aiAnchor,
          micOn,
          camOn,
          preferredLanguage,
        });

        socket.join(meetingId);

        const users = getRoomParticipantsArray(meetingId);

        if (callback) {
          callback({
            ok: true,
            message: "Room created and joined successfully",
            room: {
              meetingId: room.meetingId,
              hostId: room.hostId,
              waitingRoom: room.waitingRoom,
              aiAnchor: room.aiAnchor,
            },
            users,
            selfSocketId: socket.id,
          });
        }

        io.to(meetingId).emit("room-users", users);

        console.log(
          "Room created via join-room:",
          meetingId,
          getRoomParticipantsArray(meetingId).map((u) => ({
            socketId: u.socketId,
            name: u.name,
            isHost: u.isHost,
          }))
        );
        console.log(`Broadcasted room-users to ${meetingId}:`, users.length);
        return;
      }

      if (!room) {
        if (callback) callback({ ok: false, message: "Meeting not found" });
        socket.emit("join-error", { message: "Meeting not found" });
        return;
      }

      if (room.password && room.password !== password) {
        if (callback) callback({ ok: false, message: "Invalid password" });
        socket.emit("join-error", { message: "Invalid password" });
        return;
      }

      const alreadyInRoom = room.participants[socket.id];
      if (!alreadyInRoom) {
        room.participants[socket.id] = {
          socketId: socket.id,
          name,
          isHost: false,
          micOn,
          camOn,
          handRaised: false,
          isSharing: false,
          preferredLanguage,
        };
      }

      socketToRoom[socket.id] = meetingId;
      socket.join(meetingId);

      const joinedUser = room.participants[socket.id];
      const users = getRoomParticipantsArray(meetingId);

      if (callback) {
        callback({
          ok: true,
          message: "Joined room successfully",
          room: {
            meetingId: room.meetingId,
            hostId: room.hostId,
            waitingRoom: room.waitingRoom,
            aiAnchor: room.aiAnchor,
          },
          users,
          selfSocketId: socket.id,
        });
      }

      socket.emit("room-users", users);
      socket.to(meetingId).emit("user-joined", joinedUser);
      io.to(meetingId).emit("room-users", users);

      console.log(`${socket.id} joined room ${meetingId}`);
      console.log(
        "Room users now:",
        meetingId,
        getRoomParticipantsArray(meetingId).map((u) => ({
          socketId: u.socketId,
          name: u.name,
          isHost: u.isHost,
        }))
      );
      console.log(`Broadcasted room-users to ${meetingId}:`, users.length);
    } catch (err) {
      console.error("join-room error:", err);
      if (callback) callback({ ok: false, message: "Failed to join room" });
      socket.emit("join-error", { message: "Failed to join room" });
    }
  });

  /* ---------- LEAVE ROOM ---------- */
  socket.on("leave-room", ({ meetingId } = {}, callback) => {
    try {
      const finalMeetingId = meetingId || socketToRoom[socket.id];
      if (!finalMeetingId) {
        if (callback) callback({ ok: false, message: "User not in any room" });
        return;
      }

      socket.leave(finalMeetingId);

      const result = removeParticipantFromRoom(socket.id);

      if (!result) {
        if (callback) callback({ ok: false, message: "Nothing to remove" });
        return;
      }

      if (!result.roomDeleted) {
        const updatedUsers = getRoomParticipantsArray(result.meetingId);

        io.to(result.meetingId).emit("user-left", {
          socketId: result.removedSocketId,
        });

        io.to(result.meetingId).emit("room-users", updatedUsers);
      }

      if (callback) callback({ ok: true, message: "Left room successfully" });

      console.log(`${socket.id} left room ${finalMeetingId}`);
    } catch (err) {
      console.error("leave-room error:", err);
      if (callback) callback({ ok: false, message: "Failed to leave room" });
    }
  });

  /* ---------- PARTICIPANT UPDATE ---------- */
  socket.on("participant-update", (payload = {}) => {
    try {
      const {
        meetingId,
        micOn,
        camOn,
        handRaised,
        isSharing,
        preferredLanguage,
      } = payload;

      const finalMeetingId = meetingId || socketToRoom[socket.id];
      if (!finalMeetingId || !rooms[finalMeetingId]) return;

      const room = rooms[finalMeetingId];
      const participant = room.participants[socket.id];
      if (!participant) return;

      if (typeof micOn === "boolean") participant.micOn = micOn;
      if (typeof camOn === "boolean") participant.camOn = camOn;
      if (typeof handRaised === "boolean") participant.handRaised = handRaised;
      if (typeof isSharing === "boolean") participant.isSharing = isSharing;
      if (typeof preferredLanguage === "string") {
        participant.preferredLanguage = preferredLanguage;
      }

      io.to(finalMeetingId).emit("participant-updated", participant);
      io.to(finalMeetingId).emit(
        "room-users",
        getRoomParticipantsArray(finalMeetingId)
      );
    } catch (err) {
      console.error("participant-update error:", err);
    }
  });

  /* ---------- CHAT MESSAGE ---------- */
  socket.on("chat-message", (payload = {}) => {
    try {
      const { meetingId, text, time } = payload;
      const finalMeetingId = meetingId || socketToRoom[socket.id];
      if (!finalMeetingId || !rooms[finalMeetingId]) return;

      const participant = rooms[finalMeetingId].participants[socket.id];
      if (!participant) return;

      const message = {
        id: Date.now(),
        sender: participant.name,
        text: text || "",
        time:
          time ||
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
      };

      io.to(finalMeetingId).emit("chat-message", message);
    } catch (err) {
      console.error("chat-message error:", err);
    }
  });

  /* ---------- BASIC CAPTION RELAY ---------- */
  socket.on("speech-text", (text) => {
    try {
      const meetingId = socketToRoom[socket.id];
      if (!meetingId) return;

      io.to(meetingId).emit("translated-caption", text);
    } catch (err) {
      console.error("speech-text error:", err);
    }
  });

  /* ---------- WEBRTC SIGNALING ---------- */
  socket.on("offer", ({ target, sdp, meetingId } = {}) => {
    try {
      const finalMeetingId = meetingId || socketToRoom[socket.id];
      if (!finalMeetingId) return;

      io.to(target).emit("offer", {
        caller: socket.id,
        sdp,
      });
    } catch (err) {
      console.error("offer relay error:", err);
    }
  });

  socket.on("answer", ({ target, sdp, meetingId } = {}) => {
    try {
      const finalMeetingId = meetingId || socketToRoom[socket.id];
      if (!finalMeetingId) return;

      io.to(target).emit("answer", {
        sender: socket.id,
        sdp,
      });
    } catch (err) {
      console.error("answer relay error:", err);
    }
  });

  socket.on("ice-candidate", ({ target, candidate, meetingId } = {}) => {
    try {
      const finalMeetingId = meetingId || socketToRoom[socket.id];
      if (!finalMeetingId) return;

      io.to(target).emit("ice-candidate", {
        sender: socket.id,
        candidate,
      });
    } catch (err) {
      console.error("ice-candidate relay error:", err);
    }
  });

  /* ---------- DISCONNECT CLEANUP ---------- */
  socket.on("disconnect", () => {
    try {
      console.log(`Socket disconnected: ${socket.id}`);

      const result = removeParticipantFromRoom(socket.id);
      if (!result) return;

      if (!result.roomDeleted) {
        const updatedUsers = getRoomParticipantsArray(result.meetingId);

        io.to(result.meetingId).emit("user-left", {
          socketId: result.removedSocketId,
        });

        io.to(result.meetingId).emit("room-users", updatedUsers);
      }

      console.log(`Cleaned up socket ${socket.id}`);
    } catch (err) {
      console.error("disconnect cleanup error:", err);
    }
  });
});

/* ---------------- START SERVER ---------------- */

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
=======
  socket.on("join-room", ({ roomId, username }) => {
    console.log("join-room received:", {
      roomId,
      username,
      socketId: socket.id,
    });

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    const alreadyInRoom = rooms[roomId].some((user) => user.id === socket.id);

    if (!alreadyInRoom) {
      rooms[roomId].push({
        id: socket.id,
        name: username,
      });
    }

    socket.data.roomId = roomId;
    socket.data.username = username;

    console.log(`${username} joined room ${roomId}`);
    console.log("rooms after join:", JSON.stringify(rooms[roomId], null, 2));

    // send full participant list to everyone
    io.to(roomId).emit("participants-update", rooms[roomId]);

    // notify other users in the room that a new peer joined
    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
      username,
    });
  });

  socket.on("chat-message", ({ roomId, message, username }) => {
    console.log("chat-message received:", { roomId, username, message });

    io.to(roomId).emit("chat-message", {
      id: `${Date.now()}-${Math.random()}`,
      username,
      message,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  });

  // ------------------ WEBRTC SIGNALING ------------------

  socket.on("webrtc-offer", ({ target, offer, callerId, username }) => {
    console.log("webrtc-offer:", {
      from: callerId,
      to: target,
      username,
    });

    io.to(target).emit("webrtc-offer", {
      offer,
      callerId,
      username,
    });
  });

  socket.on("webrtc-answer", ({ target, answer, responderId }) => {
    console.log("webrtc-answer:", {
      from: responderId,
      to: target,
    });

    io.to(target).emit("webrtc-answer", {
      answer,
      responderId,
    });
  });

  socket.on("webrtc-ice-candidate", ({ target, candidate, senderId }) => {
    console.log("webrtc-ice-candidate:", {
      from: senderId,
      to: target,
    });

    io.to(target).emit("webrtc-ice-candidate", {
      candidate,
      senderId,
    });
  });

  socket.on("disconnect", () => {
    const { roomId, username } = socket.data || {};

    console.log("User disconnected:", socket.id);

    if (roomId) {
      // notify peers that this user left
      socket.to(roomId).emit("user-left", {
        socketId: socket.id,
      });
    }

    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter((user) => user.id !== socket.id);

      console.log(`${username || "User"} left room ${roomId}`);
      console.log("rooms after disconnect:", JSON.stringify(rooms[roomId], null, 2));

      io.to(roomId).emit("participants-update", rooms[roomId]);

      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        console.log(`Deleted empty room ${roomId}`);
      }
    }
  });
});

// ------------------ START SERVER ------------------
const PORT = 5000;
server.listen(PORT, () => {
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
  console.log(`Server running on http://localhost:${PORT}`);
});