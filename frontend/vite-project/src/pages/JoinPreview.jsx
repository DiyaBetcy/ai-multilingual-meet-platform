import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./JoinPreview.css";

import micOnIcon from "../assets/mic-on.jpg";
import micOffIcon from "../assets/mic-off.jpg";
import camOnIcon from "../assets/cam-on.webp";
import camOffIcon from "../assets/cam-off.jpg";

export default function JoinPreview() {
  const { mode } = useParams(); // create | join
  const navigate = useNavigate();

  /* ---------- HELPERS ---------- */
  const generateMeetingId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const generatePassword = () =>
    Math.random().toString(36).substring(2, 10);

  /* ---------- STATE ---------- */
  const [meetingId, setMeetingId] = useState("");
  const [password, setPassword] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [aiAnchor, setAiAnchor] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);

  /* ---------- AUTO GENERATE FOR CREATE ---------- */
  useEffect(() => {
    if (mode === "create") {
      setMeetingId(generateMeetingId());
      setPassword(generatePassword());
    }
  }, [mode]);

  return (
    <div className="jp-container">

      {/* ---------- TOP BAR ---------- */}
      <div className="jp-top-info">
        <h2>{mode === "create" ? "Create Meeting" : "Join Meeting"}</h2>
      </div>

      {/* ---------- MAIN CONTENT ---------- */}
      <div className="jp-main">

        {/* ---------- LEFT DETAILS ---------- */}
        <div className="jp-details">
          <input placeholder="Your Name" />

          <input
            placeholder="Meeting ID"
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
          />

          {mode === "create" && (
            <div className="jp-regenerate">
              <button onClick={() => setMeetingId(generateMeetingId())}>
               New Meeting ID
              </button>
              
            </div>
          )}

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "create" && (
            <div className="jp-regenerate">
              
              <button onClick={() => setPassword(generatePassword())}>
                Set Default Password
              </button>
            </div>
          )}

          {mode === "create" && (
            <>
              <textarea placeholder="Meeting Agenda" />

              <label className="jp-toggle">
                <input
                  type="checkbox"
                  checked={waitingRoom}
                  onChange={() => setWaitingRoom(!waitingRoom)}
                />
                Waiting Room
              </label>

              <label className="jp-toggle">
                <input
                  type="checkbox"
                  checked={aiAnchor}
                  onChange={() => setAiAnchor(!aiAnchor)}
                />
                AI Anchor Assistant
              </label>
            </>
          )}

          {mode === "join" && (
  <div className="jp-field">
    <select>
      
      <option value="en">English</option>
      <option value="hi">Hindi</option>
      <option value="ml">Malayalam</option>
      <option value="ta">Tamil</option>
    </select>
  </div>
)}

        </div>

        {/* ---------- RIGHT VIDEO ---------- */}
        <div className="jp-video-section">
          <div className="jp-video-box">
            Video Preview
          </div>

          <div className="jp-controls">
            <button onClick={() => setMicOn(!micOn)}>
              <img src={micOn ? micOnIcon : micOffIcon} alt="mic" />
            </button>

            <button onClick={() => setCamOn(!camOn)}>
              <img src={camOn ? camOnIcon : camOffIcon} alt="cam" />
            </button>
          </div>
        </div>
      </div>

      {/* ---------- ACTION BUTTON ---------- */}
      <button
        className="jp-action-btn"
        onClick={() => navigate("/meetdash")}
      >
        {mode === "create" ? "Start" : "Join"}
      </button>

    </div>
  );
}
