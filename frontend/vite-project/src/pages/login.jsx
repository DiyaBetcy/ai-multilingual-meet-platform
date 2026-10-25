import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginRequest } from "../lib/session.js";
import logoImg from "../assets/logo.png";
import "./login.css";

/* ============================================================
   Log in.

   Credentials are checked by the backend /login endpoint, which
   returns a JWT. The old demo path that stored a fake token and
   redirected has been removed: failed or unknown accounts stay on
   this page with an error.
   ============================================================ */

export default function Login() {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim() || !password) {
      setError("Enter your username/email and password.");
      return;
    }

    try {
      setSubmitting(true);
      await loginRequest(identifier.trim(), password);
      navigate("/start", { replace: true });
    } catch (requestError) {
      setError(
        requestError.message ||
          "Login failed. Check your credentials and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">

      {/* Top Bar */}
      <div className="top-bar">
        <img src={logoImg} alt="Logo" className="logo-image" />

        <div className="nav-menu">
          <span onClick={() => navigate("/")}>Home</span>
          <span onClick={() => navigate("/meetings")}>Meetings</span>
          <span onClick={() => navigate("/settings")}>Settings</span>
          <span onClick={() => navigate("/profile")}>Profile</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content oi-auth">

        {/* LEFT SIDE */}
        <div className="left-panel oi-auth-aside">
          <a className="oi-brand" onClick={() => navigate("/start")}>
            <span className="oi-brand-mark">M</span>
            <span>
              <span className="oi-brand-text brand-text">Meet</span>
              <span className="oi-brand-sub">Multilingual</span>
            </span>
          </a>

          <div style={{ position: "relative", zIndex: 1 }}>
            <span className="oi-eyebrow">Obsidian Intelligence</span>
            <h1 className="oi-auth-headline" style={{ marginTop: "var(--sp-3)" }}>
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5 9.5 18 20 6.5" />
                  </svg>
                </span>
                <span>
                  Live translated captions for English, Hindi, Malayalam and
                  Tamil.
                </span>
              </div>

              <div className="oi-auth-point">
                <span className="oi-auth-point-icon" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5 9.5 18 20 6.5" />
                  </svg>
                </span>
                <span>AI anchoring keeps speaker order and time on schedule.</span>
              </div>

              <div className="oi-auth-point">
                <span className="oi-auth-point-icon" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5 9.5 18 20 6.5" />
                  </svg>
                </span>
                <span>
                  Dark, low-glare room surfaces designed for long sessions.
                </span>
              </div>
            </div>
          </div>

          <p className="oi-auth-foot">© 2026 · Meet Multilingual Platform</p>
        </div>

        {/* RIGHT SIDE */}
        <div className="right-panel oi-auth-main">
          <div className="form-wrapper oi-auth-card">

            <div>
              <h2 className="oi-auth-title">Log in</h2>
              <p className="oi-auth-sub">
                Use the email or username you signed up with.
              </p>
            </div>

            <form className="oi-form" onSubmit={handleLogin}>
              <div className="oi-field">
                <label className="oi-label" htmlFor="login-identifier">
                  Username or Email
                </label>
                <input
                  className="oi-input"
                  id="login-identifier"
                  type="text"
                  placeholder="you@example.com"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>

              <div className="oi-field">
                <label className="oi-label" htmlFor="login-password">
                  Password
                </label>
                <input
                  className="oi-input"
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p className="oi-alert oi-alert--error" role="alert">
                  <span className="oi-alert-icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7.5v5M12 16.2v.2" />
                    </svg>
                  </span>
                  <span>{error}</span>
                </p>
              )}

              <button className="submit" type="submit" disabled={submitting}>
                {submitting ? "Logging in…" : "Login"}
              </button>
            </form>

            <p className="already-account oi-auth-alt">
              Don’t have an account?{" "}
              <a
                href="/signup"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/signup");
                }}
              >
                Create an account
              </a>
            </p>

          </div>
        </div>

      </div>

    </div>
  );
}
