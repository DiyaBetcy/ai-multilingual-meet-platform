import { useState } from "react";
import "./start.css";

export default function Start() {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  return (

    <div className="base-container">
      <div className="top-bar">
        <img src="/src/assets/logo.png" alt="Logo" className="logo-image" />
      </div>
    

    <div className="start-page">
      {/* ---------- TOP NAV ---------- */}
      <div className="start-top-bar">

        <nav className="start-menu">
          <a href="#">Home</a>
          <a href="#">Meetings</a>
          <a href="#">Settings</a>
          <a href="#">Profile</a>
        </nav>
      </div>

      {/* ---------- MAIN AREA ---------- */}
      <div className="start-main">
        {/* Buttons */}
        <div className="start-buttons">
          <button
            className="start-btn-primary"
            onClick={() => {
              setShowCreate(true);
              setShowJoin(false);
            }}
          >
            create meeting
          </button>

          <button
            className="start-btn-primary"
            onClick={() => {
              setShowJoin(true);
              setShowCreate(false);
            }}
          >
            join meeting
          </button>
        </div>

        {/* ---------- CREATE BAR ---------- */}
        {showCreate && (
          <div className="meeting-bar">
            <input type="text" placeholder="Meeting ID" />
            <input type="text" placeholder="Your Name" />

            <div className="meeting-options">
              <label>
                <input type="checkbox" /> Turn off video
              </label>
              <label>
                <input type="checkbox" /> Turn off audio
              </label>
            </div>

            <button className="action-btn">START</button>
          </div>
        )}

        {/* ---------- JOIN BAR ---------- */}
        {showJoin && (
          <div className="meeting-bar">
            <input type="text" placeholder="Meeting ID" />
            <input type="text" placeholder="Your Name" />

            <div className="meeting-options">
              <label>
                <input type="checkbox" /> Turn off video
              </label>
              <label>
                <input type="checkbox" /> Turn off audio
              </label>
            </div>

            <button className="action-btn">JOIN</button>
          </div>
        )}

        {/* ---------- FOOTER OPTION ---------- */}
        <div className="start-footer">
          <span>AI Anchor Assistant</span>
          <input type="checkbox" />
        </div>
      </div>
    </div>
</div>


    )}