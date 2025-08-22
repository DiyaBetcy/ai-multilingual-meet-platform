import { useState } from "react";
import "./start.css";

export default function start() {
  // state to show/hide popup
  const [showPopup, setShowPopup] = useState(false);

  return (
    <div className="base-container">
      
      <div className="top-bar">
        <img src="/logo.png" alt="Logo" className="logo-image" />
        <nav className="menu">
          <a href="#">Home</a>
          <a href="#">Meetings</a>
          <a href="#">Settings</a>
          <a href="#">Profile</a>
        </nav>
      </div>

      {/* ---------- MAIN CONTENT ---------- */}
      <div className="main-content">
        <button className="create-btn" onClick={() => setShowPopup(true)}>
          create meeting
        </button>
      </div>

      {/* ---------- POPUP MODAL ---------- */}
      {showPopup && (
        <div className="popup-overlay">
          <div className="popup-box">
            {/* header with logo + close button */}
            <div className="popup-header">
              <span className="popup-logo">M</span>
              <button className="close-btn" onClick={() => setShowPopup(false)}>
                X
              </button>
            </div>

            {/* popup form */}
            <div className="popup-body">
              <label>MEETING CODE :</label>
              <input type="text" />

              <label>Name:</label>
              <input type="text" />

              <div className="checkboxes">
                <label>
                  <input type="checkbox" /> Turn off my video
                </label>
                <label>
                  <input type="checkbox" /> Turn off mic
                </label>
              </div>

              {/* action buttons */}
              <div className="popup-actions">
                <button className="cancel-btn" onClick={() => setShowPopup(false)}>CANCEL</button>
                <button className="start-btn">START</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
