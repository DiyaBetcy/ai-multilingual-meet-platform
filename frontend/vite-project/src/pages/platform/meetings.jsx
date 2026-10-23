import React from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../../components/AppShell.jsx";
import "./meetings.css";

/* ============================================================
   My Meetings.

   Uses the shared workspace shell so the dashboard, the
   meetings list, the settings and the profile all sit in the
   same frame. The cards follow the OBSIDIAN INTELLIGENCE
   meeting grid; the historical class names are kept so the
   existing stylesheet contract still holds.
   ============================================================ */

const Meetings = () => {
  const navigate = useNavigate();

  const meetings = [
    {
      id: 1,
      code: "7KQ2MP",
      title: "AI Conference",
      date: "12 Feb 2026",
      time: "10:00 AM",
      tag: "AI anchored",
      tone: "champagne",
    },
    {
      id: 2,
      code: "4XB8TR",
      title: "Project Discussion",
      date: "14 Feb 2026",
      time: "2:30 PM",
      tag: "Live translation",
      tone: "emerald",
    },
    {
      id: 3,
      code: "9WD5JC",
      title: "Team Standup",
      date: "16 Feb 2026",
      time: "9:00 AM",
      tag: "Scheduled",
      tone: "muted",
    },
  ];

  return (
    <div className="meetings-container">
      <AppShell active="meetings" title="Meetings" crumb="/ Workspace">
        <main className="oi-content meetings-main">
          <div className="oi-pagehead">
            <div className="oi-pagehead-text">
              <span className="oi-eyebrow">Workspace</span>
              <h1 className="oi-page-title">My Meetings</h1>
              <p className="oi-pagehead-sub">
                Every session you have scheduled, with live translation and AI
                anchoring available in the room.
              </p>
            </div>

            <div className="meetings-header">
              <button
                type="button"
                className="oi-btn oi-btn--primary new-meeting-btn"
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
                New Meeting
              </button>
            </div>
          </div>

          <div className="oi-meetings-grid meetings-list">
            {meetings.map((meeting) => (
              <article key={meeting.id} className="oi-meeting-card meeting-card">
                <div className="oi-meeting-top">
                  <div>
                    <h3 className="oi-meeting-title">{meeting.title}</h3>
                    <div className="oi-meeting-meta">
                      <span>{meeting.date}</span>
                      <span className="oi-meeting-meta-dot" />
                      <span>{meeting.time}</span>
                    </div>
                  </div>

                  <span className={`oi-chip oi-chip--${meeting.tone}`}>
                    {meeting.tag}
                  </span>
                </div>

                <div className="oi-meeting-foot">
                  <span className="oi-meta">ID {meeting.code}</span>
                  <button
                    type="button"
                    className="oi-btn oi-btn--secondary oi-btn--sm join-btn"
                    onClick={() =>
                      navigate("/preview/join", {
                        state: { meetingId: meeting.code },
                      })
                    }
                  >
                    Join
                  </button>
                </div>
              </article>
            ))}
          </div>
        </main>
      </AppShell>
    </div>
  );
};

export default Meetings;
