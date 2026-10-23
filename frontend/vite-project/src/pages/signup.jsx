
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logoImg from "../assets/logo.png";
import "./signup.css";

const getApiBase = () => {
  if (import.meta.env.VITE_TRANSLATION_URL) {
    return import.meta.env.VITE_TRANSLATION_URL;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:5000`;
    }
  }
  if (import.meta.env.DEV) {
    return "http://localhost:5000";
  }
  return "";
};

const API_BASE = getApiBase();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function postJSON(path, body) {
  if (!API_BASE) {
    throw new Error("Backend URL is not configured. Check your .env file.");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || data.error || "Request failed");
  }

  return data;
}

export default function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const emailOk = useMemo(() => isValidEmail(email), [email]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    if (!name.trim()) {
      setError("Enter your full name.");
      return;
    }

    if (!emailOk) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const data = await postJSON("/signup", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      setStatus(data.message || "Account created successfully!");

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      // Give the user time to read the success message.
      setTimeout(() => navigate("/login"), 1000);
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="start-top-bar">
        <img src={logoImg} className="start-logo" alt="logo" />

        <div className="start-menu">
          <span onClick={() => navigate("/")}>Home</span>
          <span onClick={() => navigate("/meetings")}>Meetings</span>
          <span onClick={() => navigate("/settings")}>Settings</span>
          <span onClick={() => navigate("/profile")}>Profile</span>
        </div>
      </div>

      <div className="main-content oi-auth">
        <div className="left-panel oi-auth-aside">
          <a
            className="oi-brand"
            href="/start"
            onClick={(e) => {
              e.preventDefault();
              navigate("/start");
            }}
          >
            <span className="oi-brand-mark">M</span>
            <span>
              <span className="oi-brand-text brand-text">Meet</span>
              <span className="oi-brand-sub">Multilingual</span>
            </span>
          </a>

          <div style={{ position: "relative", zIndex: 1 }}>
            <span className="oi-eyebrow">Obsidian Intelligence</span>

            <h1
              className="oi-auth-headline"
              style={{ marginTop: "var(--sp-3)" }}
            >
              Meetings that speak every attendee&apos;s language.
            </h1>

            <p className="oi-auth-lede">
              One room for every attendee — live caption translation,
              AI-assisted speaker turns and a meeting surface built to stay
              readable for hours.
            </p>

            <div className="oi-auth-points">
              <div className="oi-auth-point">
                <span className="oi-auth-point-icon" aria-hidden="true">
                  ✓
                </span>
                <span>
                  Live translated captions for English, Hindi, Malayalam and
                  Tamil.
                </span>
              </div>

              <div className="oi-auth-point">
                <span className="oi-auth-point-icon" aria-hidden="true">
                  ✓
                </span>
                <span>
                  AI anchoring keeps speaker order and time on schedule.
                </span>
              </div>

              <div className="oi-auth-point">
                <span className="oi-auth-point-icon" aria-hidden="true">
                  ✓
                </span>
                <span>
                  Dark, low-glare room surfaces designed for long sessions.
                </span>
              </div>
            </div>
          </div>

          <p className="oi-auth-foot">
            © 2026 · Meet Multilingual Platform
          </p>
        </div>

        <div className="right-panel oi-auth-main">
          <div className="form-wrapper oi-auth-card">
            <div>
              <h2 className="oi-auth-title">Create Account</h2>
              <p className="oi-auth-sub">
                Create your account with your name, email and password.
              </p>
            </div>

            <button
              className="google-btn"
              type="button"
              onClick={() =>
                setError("Google signup is not configured by this form.")
              }
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Sign up with Google
            </button>

            <p className="or-text oi-divider">or</p>

            <form className="oi-form" onSubmit={handleSignup}>
              <div className="oi-field">
                <label className="oi-label" htmlFor="signup-name">
                  Full Name
                </label>
                <input
                  className="oi-input"
                  id="signup-name"
                  type="text"
                  placeholder="Your full name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="oi-field">
                <label className="oi-label" htmlFor="signup-email">
                  Email
                </label>
                <input
                  className="oi-input"
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="oi-form-row">
                <div className="oi-field">
                  <label className="oi-label" htmlFor="signup-password">
                    Password
                  </label>
                  <input
                    className="oi-input"
                    id="signup-password"
                    type="password"
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>

                <div className="oi-field">
                  <label
                    className="oi-label"
                    htmlFor="signup-confirm-password"
                  >
                    Confirm Password
                  </label>
                  <input
                    className="oi-input"
                    id="signup-confirm-password"
                    type="password"
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {status && (
                <p className="oi-alert oi-alert--success" role="status">
                  {status}
                </p>
              )}

              {error && (
                <p className="oi-alert oi-alert--error" role="alert">
                  {error}
                </p>
              )}

              <button
                className="submit"
                type="submit"
                disabled={loading}
              >
                {loading ? "Creating account..." : "Sign Up"}
              </button>
            </form>

            <p className="already-account oi-auth-alt">
              Already have an account?{" "}
              <a href="/login" onClick={(e) => {
                e.preventDefault();
                navigate("/login");
              }}>
                Login
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
