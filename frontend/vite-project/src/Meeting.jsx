import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import io from "socket.io-client";

export default function Meeting() {
  const { meetingId } = useParams();
  const location = useLocation();

  const socketRef = useRef(null);
  const audioRef = useRef(null);
  console.log("JOINING ROOM:", meetingId);
  const [participants, setParticipants] = useState([]);

  // ---------- SOCKET CONNECT ----------
  useEffect(() => {
  if (socketRef.current) return; // ✅ PREVENT MULTIPLE SOCKETS

  const socket = io("http://localhost:5000", {
    transports: ["websocket"],
  });

  socketRef.current = socket;

  socket.on("connect", () => {
    console.log("✅ Connected:", socket.id);

    if (!meetingId) {
      console.log("❌ No meetingId");
      return;
    }

    console.log("🚪 Joining room:", meetingId);

    socket.emit("register_participant", {
      name: location.state?.name || "Guest",
      language: location.state?.language || "en",
      roomId: meetingId.trim().toUpperCase(),
    });
  });

  socket.on("participant_list", ({ participants }) => {
    console.log("👥 Participants:", participants);
    setParticipants(participants);
  });

  return () => {
    socket.disconnect();
    socketRef.current = null;
  };
}, []);

  // ---------- START AI ANCHOR AFTER JOIN ----------
  useEffect(() => {
    if (!location.state?.aiAnchor) return;

    console.log("🎤 Starting AI Anchor AFTER join");

    const fullAgenda = `Welcome everyone to ${
      location.state.meetingTitle
    }. Today we have speakers: ${location.state.sessions
      .map((s) => `${s.speaker} on ${s.topic}`)
      .join(", ")}.`;

    setTimeout(() => {
      fetch("http://localhost:5000/start-anchor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessions: location.state.sessions,
          time: location.state.timePerSpeaker,
          full_agenda: fullAgenda,
          roomId: meetingId   // 🔥 ADD THIS
        }),
      });
    }, 1500); // 🔥 IMPORTANT DELAY
  }, []);

  // ---------- UNLOCK AUDIO BUTTON ----------
  const unlockAudio = async () => {
    const audio = new Audio();
    try {
      await audio.play();
      console.log("🔓 Audio unlocked");
    } catch {}
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Meeting ID: {meetingId}</h2>

      {/* 🔥 AUDIO UNLOCK BUTTON */}
      <button onClick={unlockAudio}>Enable Audio 🔊</button>

      {/* 🎧 AUDIO PLAYER */}
      <audio ref={audioRef} />

      {/* 👥 PARTICIPANTS */}
      <div style={{ marginTop: "20px" }}>
        <h3>Participants ({participants.length})</h3>
        <ul>
          {participants.map((p, i) => (
            <li key={i}>👤 {p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}