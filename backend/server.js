import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import Otp from './models/Otp.js'; // Make sure models/Otp.js exists
import User from "./models/User.js";
import bcrypt from "bcryptjs";

const app = express();

const corsOptions = {
  origin: "http://localhost:5173", // your Vite frontend
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Fix for preflight requests
app.options(/.*/, cors(corsOptions));

app.use(express.json());

// Connect MongoDB
mongoose.connect("mongodb+srv://meetadmin:Meet%401234@cluster0.189unnx.mongodb.net/?appName=Cluster0")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// Test route
app.get("/", (req, res) => {
  res.send("Backend is working 🚀");
});

// Function to generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000);

// POST /send-otp route
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const otp = generateOTP();

  // Configure Nodemailer
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your OTP for AI Meet Platform',
    text: `Your OTP is: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP ${otp} sent to ${email}`);

    // Save OTP in MongoDB
    const otpDoc = new Otp({ email, otp });
    await otpDoc.save();

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// POST /verify-otp route
app.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

  try {
    const otpRecord = await Otp.findOne({ email, otp });

    if (!otpRecord) return res.status(400).json({ message: 'Invalid OTP or expired' });

    // OTP is valid, delete it after verification
    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Verification failed' });
  }
});

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashed,
      isVerified: true,
    });

    return res.status(201).json({ message: "Account created successfully", userId: user._id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Signup failed" });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});