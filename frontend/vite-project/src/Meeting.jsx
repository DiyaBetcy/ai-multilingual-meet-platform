import { useEffect, useRef } from "react";
import io from "socket.io-client";

export default function Meeting() {
  const socketRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    socketRef.current = io("http://localhost:5000", {
      transports: ["websocket"],
    });

    socketRef.current.on("connect", () => {
      console.log("✅ Connected:", socketRef.current.id);

      socketRef.current.emit("register_participant", {
        language: "en",
      });
    });

    socketRef.current.on("ai_audio", ({ audio }) => {
      console.log("🎧 Received audio");

      if (!audioRef.current) return;

      // Convert base64 → Blob
      const audioBlob = new Blob(
        [Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))],
        { type: "audio/mp3" }
      );

      const url = URL.createObjectURL(audioBlob);

      audioRef.current.src = url;
    const testAudio = () => {
    const audio = new Audio(
    "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAA..."
  );
  audio.play().then(() => console.log("PLAYING")).catch(console.error);
};

      // 🔥 FORCE PLAY
      audioRef.current
        .play()
        .then(() => console.log("▶️ Playing"))
        .catch((err) => console.error("❌ Play error:", err));
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);
  const [participants, setParticipants] = useState([]);
  useEffect(() => {
  socket.on("participant_list", ({ participants }) => {
    console.log("👥 Participants:", participants);
    setParticipants(participants);
  });

  return () => socket.off("participant_list");
}, []);


  // 🔥 THIS BUTTON IS CRITICAL (UNLOCKS AUDIO)
  const startMeeting = async () => {
    console.log("🚀 Start clicked");

    // Unlock browser audio
    const audio = new Audio();
    audio.play().catch(() => {});

    await fetch("http://localhost:5000/start-anchor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_agenda: "Welcome to the AI meeting",
        time: 5,
        sessions: [
          { speaker: "Neha", topic: "AI" }
        ],
      }),
    });
  };

  return (
    
    <>
      <button onClick={startMeeting}>Start Meeting</button>
      <audio ref={audioRef} controls />
    </>
  );
}