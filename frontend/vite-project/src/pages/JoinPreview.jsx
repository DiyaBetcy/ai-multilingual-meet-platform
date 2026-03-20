import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import io from "socket.io-client";
import "./JoinPreview.css";

import micOnIcon from "../assets/mic-on.jpg";
import micOffIcon from "../assets/mic-off.jpg";
import camOnIcon from "../assets/cam-on.webp";
import camOffIcon from "../assets/cam-off.jpg";

// ✅ SINGLE SOCKET INSTANCE
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
const [participantCount, setParticipantCount] = useState(0);
  const [stream, setStream] = useState(null);

  const videoRef = useRef(null);

useEffect(() => {
  socket.on("connect", () => {
    console.log("✅ Connected:", socket.id);

    socket.emit("register_participant", {
      language: language,
      roomId: meetingId   // 🔥 MUST BE SAME
    });
  });

  socket.on("participant_count", ({ count }) => {
    console.log("👥 Participants:", count);
  });

  return () => {
    socket.off("participant_count");
  };
}, [meetingId, language]);
  // 🔥 AUDIO CONTROL
  const hasUnlockedAudio = useRef(false);

  // ---------- AUTO GENERATE ----------
  useEffect(() => {
    if (mode === "create") {
      setMeetingId(Math.random().toString(36).substring(2, 8).toUpperCase());
      setPassword(Math.random().toString(36).substring(2, 10));
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
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      } catch (err) {
        console.error("Permission denied:", err);
      }
    };

    getMedia();
  }, []);

  // ---------- SOCKET ----------
  useEffect(() => {
    socket.on("connect", () => {
      console.log("✅ Connected:", socket.id);

      socket.emit("register_participant", {
        language: language,
      });
    });

    socket.on("ai_audio", ({ audio }) => {
      console.log("🎧 Received AI audio");

      try {
        const byteArray = Uint8Array.from(atob(audio), (c) =>
          c.charCodeAt(0)
        );

        const blob = new Blob([byteArray], { type: "audio/mp3" });
        const url = URL.createObjectURL(blob);

        const sound = new Audio(url);

        sound.play()
          .then(() => console.log("🔊 Playing AI voice"))
          .catch((err) => console.error("❌ Blocked:", err));
      } catch (err) {
        console.error("Audio error:", err);
      }
    });

    return () => {
      socket.off("ai_audio");
    };
  }, []);

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
      console.error("Camera toggle error:", err);
    }
  };

  // ---------- START ----------
  const handleMeetingStart = async () => {
    if (!name.trim()) return alert("Please enter your name");

    // 🔓 UNLOCK AUDIO (IMPORTANT)
    if (!hasUnlockedAudio.current) {
      const unlockAudio = new Audio(
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
      );

      try {
        await unlockAudio.play();
        unlockAudio.pause();
        unlockAudio.currentTime = 0;
        hasUnlockedAudio.current = true;
        console.log("🔓 Audio unlocked");
      } catch (err) {
        console.error("Unlock failed:", err);
      }
    }
// Only check participants AFTER meeting started (optional)
if (mode === "create" && aiAnchor && participantCount === 0) {
  console.warn("No participants yet — starting anyway");
}
    // 🎤 START AI ANCHOR
    if (aiAnchor) {
      const fullAgenda = `Welcome everyone to ${meetingTitle}. Today we have speakers: ${sessions
        .map((s) => `${s.speaker} on ${s.topic}`)
        .join(", ")}. Each speaker will speak for ${timePerSpeaker} seconds.`;

      try {
        await fetch("http://localhost:5000/start-anchor", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessions,
            time: timePerSpeaker,
            full_agenda: fullAgenda,
          }),
        });

        console.log("🚀 Anchor started");
      } catch (err) {
        console.error("Failed to start AI Anchor:", err);
      }
    }

    // ⏳ WAIT before navigation (VERY IMPORTANT)
    setTimeout(() => {
      navigate(`/meeting/${meetingId}`, {
        state: {
          name,
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
    }, 3000);
  };
socket.emit("register_participant", {
  language: language,
  roomId: meetingId   // 🔥 VERY IMPORTANT
});

  // ---------- UI ----------
  return (
    <div className="jp-container">
      <div className="jp-top-info">
        <h2>{mode === "create" ? "Create Meeting" : "Join Meeting"}</h2>
      </div>

      <div className="jp-main">
        {/* LEFT PANEL */}
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
              <button
                onClick={() =>
                  setMeetingId(
                    Math.random().toString(36).substring(2, 8).toUpperCase()
                  )
                }
              >
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

          {/* AI SETTINGS */}
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

        {/* RIGHT VIDEO */}
        <div className="jp-video-section">
          <div className="jp-video-box">
            <video ref={videoRef} autoPlay playsInline muted />
          </div>

          <div className="jp-controls">
            <button onClick={toggleMic}>
              <img src={micOnIcon} alt="mic" />
            </button>
            <button onClick={toggleCam}>
              <img src={camOnIcon} alt="cam" />
            </button>
          </div>
        </div>
      </div>

      <button className="jp-action-btn" onClick={handleMeetingStart}>
        {mode === "create" ? "Start" : "Join"}
      </button>
    </div>
  );
}