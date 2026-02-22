import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "./JoinPreview.css";

import micOnIcon from "../assets/mic-on.jpg";
import micOffIcon from "../assets/mic-off.jpg";
import camOnIcon from "../assets/cam-on.webp";
import camOffIcon from "../assets/cam-off.jpg";

export default function JoinPreview() {
  const { mode } = useParams(); // create | join
  const navigate = useNavigate();
  const location = useLocation();

  /* ---------- HELPERS ---------- */
  const generateMeetingId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const generatePassword = () =>
    Math.random().toString(36).substring(2, 10);

  /* ---------- STATE ---------- */
  const [name, setName] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [password, setPassword] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [aiAnchor, setAiAnchor] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  /* ---------- AUTO GENERATE FOR CREATE ---------- */
useEffect(() => {
  if (mode === "create") {
    setMeetingId(generateMeetingId());
    setPassword(generatePassword());
  }

  if (mode === "join" && location.state?.meetingId) {
    setMeetingId(location.state.meetingId);
  }
}, [mode, location.state]);

  /* ---------- AUTO GENERATE FOR CREATE ---------- */
 useEffect(() => {
  let localStream;

  const getMedia = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStream = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      setCamOn(true);
    } catch (err) {
      console.error(err);
    }
  };

  getMedia();

  return () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
  };
}, []);

/* ---------- MICROPHONE TOGGLE ---------- */
const toggleMic = () => {
  if (!stream) return;

  const audioTrack = stream.getAudioTracks()[0];
  if (!audioTrack) return;

  audioTrack.enabled = !audioTrack.enabled;
  setMicOn(audioTrack.enabled);
};

/* ---------- CAMERA TOGGLE ---------- */

const toggleCam = async () => {
  try {
    if (camOn) {
      // 🔥 TURN OFF CAMERA COMPLETELY
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setStream(null);
      setCamOn(false);

    } else {
      // 🔥 START BRAND NEW CAMERA STREAM
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      setCamOn(true);
    }
  } catch (err) {
    console.error("Camera toggle error:", err);
  }
};
  /* ---------- HANDLE START / JOIN ---------- */
  const handleMeetingStart = () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!meetingId.trim()) {
      alert("Meeting ID is required");
      return;
    }

    navigate(`/meeting/${meetingId}`, {
      state: {
        name,
        mode,
        micOn,
        camOn,
        aiAnchor,
        waitingRoom,
      },
    });
  };

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

          <input
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

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
  <video
    ref={videoRef}
    autoPlay
    playsInline
    muted
    style={{ width: "100%", height: "100%" }}
  />
</div>

          <div className="jp-controls">
            <button onClick={toggleMic}>
  <img src={micOn ? micOnIcon : micOffIcon} alt="mic" />
</button>

            <button onClick={toggleCam}>
  <img src={camOn ? camOnIcon : camOffIcon} alt="cam" />
</button>
          </div>
        </div>
      </div>

      {/* ---------- ACTION BUTTON ---------- */}
      <button
        className="jp-action-btn"
        onClick={handleMeetingStart}
      >
        {mode === "create" ? "Start" : "Join"}
      </button>

    </div>
  );
}