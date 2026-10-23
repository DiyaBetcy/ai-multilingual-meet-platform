
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const {
  connectMongo,
  describeMongoError,
} = require("./config/database");

const router = express.Router();

/* ---------------- MODELS ---------------- */

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "users" }
);

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    otp: { type: Number, required: true },
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 300 },
  },
  { collection: "otps" }
);

const User =
  mongoose.models.User || mongoose.model("User", userSchema);

const Otp =
  mongoose.models.Otp || mongoose.model("Otp", otpSchema);

/* ---------------- DATABASE CONNECTION ---------------- */

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    const error = new Error("JWT_SECRET is not configured");
    error.code = "AUTH_NOT_CONFIGURED";
    throw error;
  }

  return process.env.JWT_SECRET;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function exactInsensitive(value) {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { $regex: `^${escaped}$`, $options: "i" };
}

function issueToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
}

/* ---------------- AUTH CONFIGURATION ---------------- */

router.use(async (req, res, next) => {
  try {
    getJwtSecret();
    await connectMongo();
    next();
  } catch (error) {
    if (error.code === "AUTH_NOT_CONFIGURED") {
      return res.status(503).json({
        message:
          "Authentication is not configured. Check MONGO_URI and JWT_SECRET.",
      });
    }

    console.error(
      "Authentication database error:",
      describeMongoError(error)
    );

    return res.status(503).json({
      message:
        "Authentication database is unavailable. Check your MongoDB connection.",
    });
  }
});

/* ---------------- OPTIONAL OTP ROUTES ---------------- */
/* These routes are retained for compatibility, but signup does not
   require OTP verification. */

router.post("/send-otp", async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!isValidEmail(email)) {
    return res.status(400).json({
      message: "Enter a valid email address.",
    });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(503).json({
      message: "Email delivery is not configured.",
    });
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000);

    await Otp.deleteMany({ email });
    await Otp.create({ email, otp, verified: false });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your verification code",
      text: `Your one-time code is: ${otp}\nIt expires in 5 minutes.`,
    });

    return res.status(200).json({
      message: "OTP sent successfully.",
    });
  } catch (error) {
    console.error("Send OTP error:", error.message);

    return res.status(500).json({
      message: "Failed to send OTP.",
    });
  }
});

router.post("/verify-otp", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const otp = Number(req.body?.otp);

  if (!isValidEmail(email) || !Number.isFinite(otp)) {
    return res.status(400).json({
      message: "Email and OTP are required.",
    });
  }

  try {
    const record = await Otp.findOne({ email, otp });

    if (!record) {
      return res.status(400).json({
        message: "Invalid OTP or expired.",
      });
    }

    record.verified = true;
    await record.save();

    return res.status(200).json({
      message: "OTP verified successfully.",
    });
  } catch (error) {
    console.error("Verify OTP error:", error.message);

    return res.status(500).json({
      message: "OTP verification failed.",
    });
  }
});

/* ---------------- SIGNUP WITHOUT OTP ---------------- */

router.post("/signup", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!name || !isValidEmail(email) || !password) {
    return res.status(400).json({
      message: "Please enter your name, a valid email, and password.",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: "Password must be at least 6 characters.",
    });
  }

  try {
    const existing = await User.findOne({ email });

    if (existing) {
      return res.status(409).json({
        message: "Email already registered. Please log in.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user;
    try {
      user = await User.create({
        name,
        email,
        password: hashedPassword,
        isVerified: true,
      });
    } catch (createError) {
      if (createError?.code === 11000) {
        return res.status(409).json({
          message: "Email already registered. Please log in.",
        });
      }
      throw createError;
    }

    return res.status(201).json({
      message: "Account created successfully!",
      userId: user._id.toString(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "Email already registered. Please log in.",
      });
    }

    console.error("Signup error:", error.message);

    return res.status(500).json({
      message: "Signup failed. Please try again.",
    });
  }
});

/* ---------------- LOGIN ---------------- */

router.post("/login", async (req, res) => {
  const identifier = String(
    req.body?.identifier || req.body?.email || ""
  ).trim();

  const password = String(req.body?.password || "");

  if (!identifier || !password) {
    return res.status(400).json({
      message: "Email/username and password are required.",
    });
  }

  try {
    const user = identifier.includes("@")
      ? await User.findOne({
          email: exactInsensitive(identifier),
        })
      : await User.findOne({
          name: exactInsensitive(identifier),
        });

    if (!user) {
      return res.status(401).json({
        message: "Account not found. Please register first.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Incorrect password. Please try again.",
      });
    }

    return res.status(200).json({
      token: issueToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Login failed. Please try again.",
    });
  }
});

/* ---------------- SESSION CHECK ---------------- */

router.get("/me", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : "";

  if (!token) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());

    if (!payload?.sub || !mongoose.isValidObjectId(payload.sub)) {
      return res.status(401).json({
        message: "Invalid session.",
      });
    }

    const user = await User.findById(payload.sub).select("name email");

    if (!user) {
      return res.status(401).json({
        message: "Invalid session.",
      });
    }

    return res.status(200).json({
      user: publicUser(user),
    });
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError"
    ) {
      return res.status(401).json({
        message: "Invalid or expired session.",
      });
    }

    console.error("Session check error:", error.message);

    return res.status(500).json({
      message: "Session check failed.",
    });
  }
});

module.exports = router;
