import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import Otp from "./models/Otp.js";
import User from "./models/User.js";
import bcrypt from "bcryptjs";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Test route
app.get("/", (req, res) => {
  res.send("Backend is working 🚀");
});

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

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

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
  console.log(`Server running on http://localhost:${PORT}`);
});