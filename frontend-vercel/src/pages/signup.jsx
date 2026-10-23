import React, { useEffect, useMemo, useState } from "react";
import "./signup.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function postJSON(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const emailOk = useMemo(() => isValidEmail(email), [email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const resetOtpState = () => {
    setOtp("");
    setOtpSent(false);
    setOtpVerified(false);
    setCooldown(0);
  };

  const handleSendOtp = async () => {
    setError("");
    setStatus("");
    setOtpVerified(false);

    if (!emailOk) return setError("Enter a valid email first.");

    try {
      setSendingOtp(true);
      const data = await postJSON("/send-otp", { email });
      setStatus(data.message || "OTP sent successfully");
      setOtpSent(true);
      setCooldown(60);
    } catch (e) {
      setError(e.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setStatus("");

    if (!emailOk) return setError("Enter a valid email.");
    if (!otp.trim()) return setError("Enter the OTP you received.");

    const otpNum = Number(otp);
    if (!Number.isFinite(otpNum)) return setError("OTP must be a number.");

    try {
      setVerifyingOtp(true);
      const data = await postJSON("/verify-otp", { email, otp: otpNum });
      setStatus(data.message || "OTP verified successfully");
      setOtpVerified(true);
    } catch (e) {
      setOtpVerified(false);
      setError(e.message || "Invalid OTP or expired");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    if (!name.trim()) return setError("Enter your full name.");
    if (!emailOk) return setError("Enter a valid email.");
    if (!otpVerified) return setError("Verify OTP before signing up.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    try {
  const data = await postJSON("/signup", { name, email, password });
  setStatus(data.message || "Account created successfully!");
  setError("");

  // optional: clear form
  setName("");
  setEmail("");
  setPassword("");
  setConfirmPassword("");
  setOtp("");
  setOtpSent(false);
  setOtpVerified(false);

  // optional: redirect to login page
  // window.location.href = "/login";
} catch (e) {
  setError(e.message || "Signup failed");
  setStatus("");
}
  };

  return (
    <div className="signup-container">
      <div className="start-top-bar">
        <img src="/src/assets/logo.png" className="start-logo" alt="logo" />
        <div className="start-menu">
          <span>Home</span>
          <span>Meetings</span>
          <span>Settings</span>
          <span>Profile</span>
        </div>
      </div>

      <div className="main-content">
        <div className="left-panel">
          <h1 className="brand-text">Meet</h1>
        </div>

        <div className="right-panel">
          <div className="form-wrapper">
            <h2>Create Account</h2>

            <button className="google-btn" type="button">
              Sign up with Google
            </button>

            <p className="or-text">— or —</p>

            <form onSubmit={handleSignup}>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setStatus("");
                  setError("");
                  resetOtpState();
                }}
              />

              {/* ✅ Send OTP */}
              <p className="send-otp">
                <button
                  type="button"
                  className="send-otp-btn"
                  onClick={handleSendOtp}
                  disabled={!emailOk || sendingOtp || cooldown > 0}
                  title={!emailOk ? "Enter a valid email first" : ""}
                >
                  {sendingOtp
                    ? "Sending..."
                    : cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : "Send OTP"}
                </button>
              </p>

              {/* ✅ OTP input + verify appears only after sending OTP */}
              {otpSent && (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 15 }}>
                  <input
                    type="text"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    style={{ flex: 1, marginBottom: 0 }}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifyingOtp || !otp.trim()}
                    style={{ height: 42 }}
                  >
                    {verifyingOtp ? "Verifying..." : otpVerified ? "Verified" : "Verify"}
                  </button>
                </div>
              )}

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <button className="submit" type="submit" disabled={!otpVerified}>
                Sign Up
              </button>

              {status && <p style={{ marginTop: 10, color: "green" }}>{status}</p>}
              {error && <p style={{ marginTop: 10, color: "red" }}>{error}</p>}
            </form>

            <p className="already-account">
              Already have an account? <a href="/login">Login</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}