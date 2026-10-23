import React from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../../components/AppShell.jsx";
import { clearSession, getStoredUser } from "../../lib/session.js";
import "./profile.css";

/* ============================================================
   Profile.

   The page renders inside the shared workspace shell and shows the
   user returned by the authenticated session. Log out clears that
   session and returns to /login.
   ============================================================ */

const Profile = () => {
  const navigate = useNavigate();
  const user = getStoredUser();

  const displayName = user?.name?.trim() || "Your Name";
  const displayEmail = user?.email || "you@example.com";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "YN";

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="profile-container">

      <AppShell active="profile" title="Profile" crumb="/ Account">
        <main className="oi-content profile-main">
          <div className="oi-pagehead">
            <div className="oi-pagehead-text">
              <span className="oi-eyebrow">Account</span>
              <h1 className="oi-page-title">Profile</h1>
              <p className="oi-pagehead-sub">
                Your meeting identity and the activity you have generated so far.
              </p>
            </div>
          </div>

          <section className="profile-card oi-card">
            <div className="profile-avatar">
              <div className="avatar-circle">{initials}</div>
            </div>

            <div className="profile-details">
              <h2 className="oi-card-title">{displayName}</h2>
              <p className="email oi-meta">{displayEmail}</p>

              <div className="profile-info">
                <div className="info-box">
                  <span>Total Meetings</span>
                  <strong>24</strong>
                </div>

                <div className="info-box">
                  <span>Hosted</span>
                  <strong>10</strong>
                </div>

                <div className="info-box">
                  <span>Joined</span>
                  <strong>14</strong>
                </div>
              </div>

              <div className="profile-actions">
                <button type="button" className="edit-btn oi-btn oi-btn--secondary">
                  Edit Profile
                </button>
                <button
                  type="button"
                  className="edit-btn oi-btn oi-btn--secondary"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </div>
            </div>
          </section>
        </main>
      </AppShell>

    </div>
  );
};

export default Profile;
