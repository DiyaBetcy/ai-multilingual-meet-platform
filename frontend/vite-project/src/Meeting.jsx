import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { io } from "socket.io-client";

export default function Meeting() {
  const { meetingId } = useParams();
  const location = useLocation();

  const socketRef = useRef(null);
  const audioRef = useRef(null);

  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    if (!meetingId) return;

    const socket = io("http://localhost:5000", {
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      const room = meetingId.trim().toUpperCase();

      console.log("🚪 Joining:", room);

      socket.emit("register_participant", {
        name: location.state?.name || "Guest",
        roomId: room,
      });
    });

    socket.on("participant_list", ({ participants }) => {
      console.log("👥", participants);
      setParticipants(participants);
    });

    socket.on("ai_audio", ({ audio }) => {
      console.log("🔊 audio received");

      const blob = new Blob(
        [Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))],
        { type: "audio/mp3" }
      );

      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(console.error);
      }
    });

    return () => socket.disconnect();
  }, [meetingId]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Meeting ID: {meetingId}</h2>

      <audio ref={audioRef} />

      <h3>Participants ({participants.length})</h3>
      <ul>
        {participants.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </div>
  );
}