import { useState } from "react";
import AppShell from "../../components/AppShell.jsx";
import "./settings.css";

/* ============================================================
   Settings.

   Renders inside the shared workspace shell. The preferences,
   their state and the controls are unchanged — only the
   presentation was ported to the OBSIDIAN INTELLIGENCE
   primitives.
   ============================================================ */

export default function Settings() {
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="settings-container">
      <AppShell active="settings" title="Settings" crumb="/ Workspace">
        <main className="oi-content settings-main">
          <div className="oi-pagehead">
            <div className="oi-pagehead-text">
              <span className="oi-eyebrow">Workspace</span>
              <h1 className="oi-page-title">Settings</h1>
              <p className="oi-pagehead-sub">
                Room defaults and how the platform keeps you informed.
              </p>
            </div>
          </div>

          <div className="settings-card oi-card">
            <div className="setting-item">
              <span>Dark Mode</span>
              <label className="oi-check">
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={() => setDarkMode(!darkMode)}
                  aria-label="Dark Mode"
                />
              </label>
            </div>

            <div className="setting-item">
              <span>Enable Notifications</span>
              <label className="oi-check">
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={() => setNotifications(!notifications)}
                  aria-label="Enable Notifications"
                />
              </label>
            </div>

            <div className="setting-item">
              <span>Default Camera</span>
              <select className="oi-select" defaultValue="Integrated Camera">
                <option>Integrated Camera</option>
                <option>External Camera</option>
              </select>
            </div>

            <div className="setting-item">
              <span>Default Microphone</span>
              <select className="oi-select" defaultValue="Built-in Mic">
                <option>Built-in Mic</option>
                <option>External Mic</option>
              </select>
            </div>
          </div>
        </main>
      </AppShell>
    </div>
  );
}
