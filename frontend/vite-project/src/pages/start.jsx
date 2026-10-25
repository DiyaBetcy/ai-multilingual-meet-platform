import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell.jsx";
import "./start.css";

/* ============================================================
   Workspace home.

   Layout is the approved OBSIDIAN INTELLIGENCE dashboard:
   a shared application shell (sidebar + topbar) with a page
   head, the two primary actions and a quick-join form.

   The two actions still route to the real preview screens
   (/preview/create and /preview/join). The quick-join form
   hands the meeting ID — and the device preferences — to
   /preview/join through the router state the preview screen
   already understands.
   ============================================================ */

export default function Start() {
  const navigate = useNavigate();
  const [meetingId, setMeetingId] = useState("");
  const [videoOff, setVideoOff] = useState(false);
  const [micOff, setMicOff] = useState(false);

  const handleQuickJoin = (e) => {
    e.preventDefault();
    const id = meetingId.trim();
    if (!id) return;

    navigate("/preview/join", {
      state: { meetingId: id, videoOff, micOff },
    });
  };

  return (
    <div className="start-page">
      <AppShell active="home" title="Home" crumb="/ Workspace">
        <main className="oi-content start-main">
          <div className="oi-pagehead">
            <div className="oi-pagehead-text">
              <span className="oi-eyebrow">Workspace</span>
              <h1 className="oi-page-title">Welcome back</h1>
              <p className="oi-pagehead-sub">
                Start a new meeting or join an existing one with a meeting ID.
                Live translation and AI anchoring are available once you are in a
                room.
              </p>
            </div>

            <div className="start-buttons">
              <button
                type="button"
                className="oi-btn oi-btn--secondary start-btn"
                onClick={() => navigate("/preview/join")}
              >
                <span className="oi-btn-icon" aria-hidden="true">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <path d="M10 17l5-5-5-5" />
                    <path d="M15 12H3" />
                  </svg>
                </span>
                Join meeting
              </button>

              <button
                type="button"
                className="oi-btn oi-btn--primary start-btn"
                onClick={() => navigate("/preview/create")}
              >
                <span className="oi-btn-icon" aria-hidden="true">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                Create meeting
              </button>
            </div>
          </div>

          <section aria-labelledby="start-actions-title">
            <h2 className="oi-section-title" id="start-actions-title">
              Start something
            </h2>

            <div className="oi-action-grid">
              <button
                type="button"
                className="oi-action-card oi-action-card--primary"
                onClick={() => navigate("/preview/create")}
              >
                <span className="oi-action-icon" aria-hidden="true">
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 10.5 20.5 7v10L15 13.5z" />
                    <rect x="2.5" y="5.5" width="12.5" height="13" rx="2.4" />
                  </svg>
                </span>
                <span className="oi-action-text">
                  <span className="oi-action-title">Create meeting</span>
                  <span className="oi-action-desc">
                    Generate a meeting ID and configure your camera, mic and
                    language before you join.
                  </span>
                </span>
              </button>

              <button
                type="button"
                className="oi-action-card"
                onClick={() => navigate("/preview/join")}
              >
                <span className="oi-action-icon" aria-hidden="true">
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10.5 13.5 6 16.8a2.2 2.2 0 0 1-3.3-2.2 13 13 0 0 1 10.9-10.9A2.2 2.2 0 0 1 15.8 7z" />
                    <path d="M15.5 8.5 21 14l-5.5 5.5L10 14z" />
                  </svg>
                </span>
                <span className="oi-action-text">
                  <span className="oi-action-title">Join meeting</span>
                  <span className="oi-action-desc">
                    Enter a meeting ID to join a session that is already in
                    progress.
                  </span>
                </span>
              </button>
            </div>
          </section>

          <section aria-labelledby="start-quickjoin-title">
            <div className="oi-meetings-head">
              <h2 className="oi-section-title" id="start-quickjoin-title">
                Quick join
              </h2>
              <span className="oi-meta">
                Enter a meeting ID to jump straight into a room
              </span>
            </div>

            <form className="oi-join-form start-meeting-bar" onSubmit={handleQuickJoin}>
              <div className="oi-field">
                <label className="oi-label" htmlFor="start-meeting-id">
                  Meeting ID
                </label>
                <input
                  id="start-meeting-id"
                  className="oi-input"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  placeholder="e.g. 7KQ2MP"
                  autoComplete="off"
                />
              </div>

              <div className="oi-join-options start-options">
                <label className="oi-check">
                  <input
                    type="checkbox"
                    checked={videoOff}
                    onChange={(e) => setVideoOff(e.target.checked)}
                  />
                  Video off
                </label>
                <label className="oi-check">
                  <input
                    type="checkbox"
                    checked={micOff}
                    onChange={(e) => setMicOff(e.target.checked)}
                  />
                  Mic off
                </label>
              </div>

              <button type="submit" className="oi-btn oi-btn--primary start-action-btn">
                Join
              </button>
            </form>
          </section>
        </main>
      </AppShell>
    </div>
  );
}
