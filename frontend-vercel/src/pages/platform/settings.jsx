import { useState } from "react";
import "./settings.css";

export default function Settings() {
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="settings-container">
      <h1>Settings</h1>

      <div className="settings-card">
        <div className="setting-item">
          <span>Dark Mode</span>
          <input
            type="checkbox"
            checked={darkMode}
            onChange={() => setDarkMode(!darkMode)}
          />
        </div>

        <div className="setting-item">
          <span>Enable Notifications</span>
          <input
            type="checkbox"
            checked={notifications}
            onChange={() => setNotifications(!notifications)}
          />
        </div>

        <div className="setting-item">
          <span>Default Camera</span>
          <select>
            <option>Integrated Camera</option>
            <option>External Camera</option>
          </select>
        </div>

        <div className="setting-item">
          <span>Default Microphone</span>
          <select>
            <option>Built-in Mic</option>
            <option>External Mic</option>
          </select>
        </div>

      </div>
    </div>
  );
}
