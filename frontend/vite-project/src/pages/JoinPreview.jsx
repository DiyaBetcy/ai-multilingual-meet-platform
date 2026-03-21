import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { io } from "socket.io-client"; // ✅ FIXED IMPORT
import "./JoinPreview.css";

import micOnIcon from "../assets/mic-on.jpg";
import micOffIcon from "../assets/mic-off.jpg";
import camOnIcon from "../assets/cam-on.webp";
import camOffIcon from "../assets/cam-off.jpg";

// ✅ SINGLE SOCKET
const socket = io("http://localhost:5000", {
  transports: ["websocket"],
});

export default function JoinPreview() {
  const { mode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // ---------- STATES ----------
  const [name, setName] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [password, setPassword] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [aiAnchor, setAiAnchor] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);

  const [meetingTitle, setMeetingTitle] = useState("");
  const [language, setLanguage] = useState("en");
  const [timePerSpeaker, setTimePerSpeaker] = useState(30);
  const [sessions, setSessions] = useState([{ speaker: "", topic: "" }]);

  const [stream, setStream] = useState(null);

  const videoRef = useRef(null);
  const hasUnlockedAudio = useRef(false);

  // ---------- GENERATORS ----------
  const generateMeetingId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const generatePassword = () =>
    Math.random().toString(36).substring(2, 10);

  // ---------- AUTO SET ----------
  useEffect(() => {
    if (mode === "create") {
      setMeetingId(generateMeetingId());
      setPassword(generatePassword());
    }

    if (mode === "join" && location.state?.meetingId) {
      setMeetingId(location.state.meetingId);
    }
  }, [mode, location.state]);

  // ---------- MEDIA ----------
  useEffect(() => {
    const getMedia = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Permission denied:", err);
      }
    };

    getMedia();
  }, []);

  // ---------- SOCKET REGISTER ----------
  useEffect(() => {
    if (!meetingId) return;

    socket.on("connect", () => {
      console.log("✅ Connected:", socket.id);

      socket.emit("register_participant", {
        name: name || "Guest",
        roomId: meetingId.trim().toUpperCase(), // ✅ FIXED
      });
    });

    return () => {
      socket.off("connect");
    };
  }, [meetingId, name]);

  // ---------- MIC ----------
  const toggleMic = () => {
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  };

  // ---------- CAM ----------
  const toggleCam = async () => {
    try {
      if (camOn) {
        stream?.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        setCamOn(false);
      } else {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        setStream(newStream);
        if (videoRef.current) videoRef.current.srcObject = newStream;
        setCamOn(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  // ---------- START / JOIN ----------
  const handleMeetingStart = async () => {
    if (!name.trim()) return alert("Enter your name");
    if (!meetingId.trim()) return alert("Meeting ID required");

  const finalRoom = meetingId.trim().toUpperCase();

    // 🔓 UNLOCK AUDIO (CRITICAL FIX)
    if (!hasUnlockedAudio.current) {
      try {
        const audio = new Audio(
          "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
        );
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        hasUnlockedAudio.current = true;
        console.log("🔓 Audio unlocked");
      } catch (err) {
        console.error("Unlock failed:", err);
      }
    }

    // 🎤 START AI ANCHOR
    if (mode === "create" && aiAnchor) {
      const fullAgenda = `Welcome everyone to ${meetingTitle}. Today we have speakers: ${sessions
        .map((s) => `${s.speaker} on ${s.topic}`)
        .join(", ")}. Each speaker will speak for ${timePerSpeaker} seconds.`;
await fetch("http://localhost:5000/start-anchor", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sessions,
    time: timePerSpeaker,
    full_agenda: fullAgenda,
    roomId: meetingId   // 🔥 THIS IS CRITICAL
  }),
});
}

    // 👉 NAVIGATE (DO NOT CHANGE UI)
    navigate(`/meeting/${finalRoom}`, {
      state: {
        name,
        meetingId: finalRoom,
        mode,
        micOn,
        camOn,
        aiAnchor,
        waitingRoom,
        meetingTitle,
        language,
        timePerSpeaker,
        sessions,
      },
    });
  };

  // ---------- UI (UNCHANGED) ----------
  return (
    <div className="jp-container">
      <div className="jp-top-info">
        <h2>{mode === "create" ? "Create Meeting" : "Join Meeting"}</h2>
      </div>

      <div className="jp-main">
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
            <>
              <input
                placeholder="Meeting Title"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
              />

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="ml">Malayalam</option>
                <option value="ta">Tamil</option>
              </select>

              <input
                type="number"
                value={timePerSpeaker}
                onChange={(e) => setTimePerSpeaker(Number(e.target.value))}
              />

              <div>
                <h3>Speakers & Topics</h3>
                {sessions.map((s, i) => (
                  <div key={i}>
                    <input
                      placeholder="Speaker"
                      value={s.speaker}
                      onChange={(e) => {
                        const updated = [...sessions];
                        updated[i].speaker = e.target.value;
                        setSessions(updated);
                      }}
                    />
                    <input
                      placeholder="Topic"
                      value={s.topic}
                      onChange={(e) => {
                        const updated = [...sessions];
                        updated[i].topic = e.target.value;
                        setSessions(updated);
                      }}
                    />
                  </div>
                ))}
                <button
                  onClick={() =>
                    setSessions([...sessions, { speaker: "", topic: "" }])
                  }
                >
                  + Add Speaker
                </button>
              </div>

              <label className="jp-toggle">
                <input
                  type="checkbox"
                  checked={aiAnchor}
                  onChange={() => setAiAnchor(!aiAnchor)}
                />
                AI Anchor
              </label>
            </>
          )}
        </div>

        <div className="jp-video-section">
          <div className="jp-video-box">
            <video ref={videoRef} autoPlay playsInline muted />
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

      <button className="jp-action-btn" onClick={handleMeetingStart}>
        {mode === "create" ? "Start" : "Join"}
      </button>
);
}