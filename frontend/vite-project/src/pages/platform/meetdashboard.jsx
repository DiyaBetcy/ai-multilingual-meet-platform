import { io } from "socket.io-client";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./meetdashboard.css";
import Popup from "./popup.jsx";
import ParticipantsPanel from "./ParticipantsPanel.jsx";
import ChatPanel from "./ChatPanel.jsx";

export default function MeetDashboard() {

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastSpokenRef = useRef("");
  const streamRef = useRef(new MediaStream()); // ✅ FIX: use ref for stable stream

  const navigate = useNavigate();
  const location = useLocation();
  const audioRef = useRef(null);
  const previewMicOn = location.state?.micOn ?? true;
  const previewCamOn = location.state?.camOn ?? false;

  const [selectedLanguage] = useState("ml-IN");
  const [showPopup, setShowPopup] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [meetingSeconds, setMeetingSeconds] = useState(0);
  const [meetingRunning, setMeetingRunning] = useState(true);
  const [micOn, setMicOn] = useState(previewMicOn);
  const [camOn, setCamOn] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionText, setCaptionText] = useState("");
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  /* ---- SOCKET ---- */
  useEffect(() => {
    socketRef.current = io("http://localhost:5000");

    socketRef.current.on("translated-caption", (text) => {
      console.log("CAPTION RECEIVED ✅", text);

      if (!text) return;

      setCaptionText(text);
    });

    socketRef.current.on("tts-audio", (base64Audio) => {
      console.log("TTS AUDIO RECEIVED ✅");

      if (!base64Audio) return;

      playBase64Audio(base64Audio);
    });

    return () => {
      socketRef.current.off("translated-caption");
      socketRef.current.off("tts-audio");
      socketRef.current.disconnect();
    };
  }, []);

  /* ---- TIMER ---- */
  useEffect(() => {
    if (!meetingRunning) return;
    const interval = setInterval(() => setMeetingSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [meetingRunning]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  /* ---- SPEECH RECOGNITION ---- */
  useEffect(() => {
    if (!captionsEnabled || !micOn) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech Recognition not supported"); return; }
    if (recognitionRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      if (!micOn) return;
      const text = event.results[event.results.length - 1][0].transcript;
      if (socketRef.current?.connected) {
        socketRef.current.emit("speech-text", text);
      }
    };

    recognition.onerror = (e) => console.error("Recognition error:", e);
    recognition.onend = () => {
      if (captionsEnabled && micOn) recognition.start();
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [captionsEnabled, micOn]);

  /* ---- CLEANUP ---- */
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      speechSynthesis.cancel();
      streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  /* ---- MIC ---- */
  const toggleMic = async () => {
    const existing = streamRef.current.getAudioTracks()[0];
    if (!existing) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current.addTrack(s.getAudioTracks()[0]);
        setMicOn(true);
      } catch (e) { console.error("Mic error:", e); }
      return;
    }
    existing.enabled = !existing.enabled;
    setMicOn(existing.enabled);
  };

  /* ---- CAMERA ---- */
  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = s.getVideoTracks()[0];
      streamRef.current.addTrack(track);
      // ✅ FIX: re-assign srcObject so video element picks up new track
      if (localVideoRef.current) localVideoRef.current.srcObject = streamRef.current;
      setCamOn(true);
    } catch (e) { console.error("Camera error:", e); }
  };

  const toggleCam = async () => {
    const existing = streamRef.current.getVideoTracks()[0];
    if (!existing) { await startCamera(); return; }
    existing.enabled = !existing.enabled;
    setCamOn(existing.enabled);
  };

  /* ---- SCREEN SHARE ---- */
  const startScreenShare = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];
      const existing = streamRef.current.getVideoTracks()[0];
      if (existing) streamRef.current.removeTrack(existing);
      streamRef.current.addTrack(screenTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = streamRef.current;
      setIsSharing(true);
      screenTrack.onended = stopScreenShare;
    } catch (e) { console.error("Screen share error:", e); }
  };
  const unlockAudio = () => {
    console.log("Force playing audio 🔊");
  if (!audioUnlocked) {
    const audio = new Audio("data:audio/mpeg;base64,//uQZAAAAAAAAAAAAAAAAAAAA"); // tiny silent audio
    audio.play().then(() => {
      console.log("Audio unlocked 🔊");
      setAudioUnlocked(true);
    }).catch(err => console.error("Unlock failed:", err));
  }
};

  const playBase64Audio = (base64) => {
  console.log("playBase64Audio called");

  try {
    const audio = new Audio("data:audio/mpeg;base64," + base64);

    audio.play()
      .then(() => console.log("Playing audio 🔊"))
      .catch(err => console.error("Play error:", err));

  } catch (e) {
    console.error("Audio error:", e);
  }
};

  const stopScreenShare = () => {
    const track = streamRef.current.getVideoTracks()[0];
    if (track) { streamRef.current.removeTrack(track); track.stop(); }
    setIsSharing(false);
    setCamOn(false);
  };

  /* ---- CHAT ---- */
  const sendMessage = (text) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages(prev => [...prev, { id: Date.now(), sender: "You", text, time }]);
    if (!showChat) setUnreadCount(c => c + 1);
  };

  const handleOpenChat = () => {
    setShowChat(true);
    setUnreadCount(0); // ✅ FIX: clear badge when opened
  };

  /* ---- END MEETING ---- */
  const endMeeting = () => {
    setMeetingRunning(false);
    streamRef.current.getTracks().forEach(t => t.stop());
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setCamOn(false); setMicOn(false); setIsSharing(false); setHandRaised(false);
    navigate("/start");
  };

  const participants = [{ id: "me", name: "You (Host)", isYou: true, micOn, camOn, handRaised }];

  return (
    <div className="base-container">
      <div className="main-content">

        {/* Timer */}
        <div className="meeting-timer">{formatTime(meetingSeconds)}</div>

        <video
          ref={localVideoRef}
          autoPlay muted playsInline
          className="main-video"
          style={{ display: (camOn || isSharing) ? "block" : "none" }}
        />

        {captionsEnabled && (
          <div className="caption-overlay">
            {captionText || "🎤 Listening..."}
          </div>
        )}

        {!camOn && !isSharing && <div className="main-video no-cam">📷 Camera off</div>}

        <div className="side-videos">
          {[...Array(6)].map((_, i) => <div key={i} className="video-tile" />)}
        </div>
      </div>

      <div className="controls">

        {/* Mic */}
        <button className={`control-btn ${micOn ? "on" : "off"}`} onClick={async () => { unlockAudio(); await toggleMic(); }} title={micOn ? "Mute" : "Unmute"}>
          {micOn ? "🎙️" : "🔇"}
        </button>

        {/* Camera */}
        <button className={`control-btn ${camOn ? "on" : "off"}`} onClick={toggleCam} title={camOn ? "Stop Camera" : "Start Camera"}>
          {camOn ? "📹" : "📷"}
        </button>

        {/* Captions / TTS toggle */}
        <button className={`control-btn ${captionsEnabled ? "on" : "off"}`} onClick={() => { unlockAudio(); setCaptionsEnabled(p => !p); }} title="Toggle Captions + Voice">
          {captionsEnabled ? "CC" : "cc"}
        </button>

        {/* Hand raise */}
        <button className={`control-btn ${handRaised ? "on raised" : "off"}`} onClick={() => setHandRaised(p => !p)} title={handRaised ? "Lower Hand" : "Raise Hand"}>
          ✋
        </button>

        {/* Participants */}
        <button className="control-btn on" onClick={() => setShowPeople(true)} title="Participants">👥</button>

        {/* Chat */}
        <button className="control-btn on chat-btn" onClick={handleOpenChat} title="Chat">
          💬
          {unreadCount > 0 && <span className="chat-badge">{unreadCount}</span>}
        </button>

        {/* Screen share */}
        <button className={`control-btn ${isSharing ? "on" : "off"}`} onClick={isSharing ? stopScreenShare : startScreenShare} title={isSharing ? "Stop Sharing" : "Share Screen"}>
          🖥️
        </button>

        {/* More */}
        <button className="control-btn on" onClick={() => setShowPopup(true)} title="More options">⚙️</button>

        {/* End call */}
        <button className="control-btn end" onClick={endMeeting} title="End Meeting">📵</button>
      </div>

      <Popup open={showPopup} onClose={() => setShowPopup(false)} />
      <ParticipantsPanel open={showPeople} onClose={() => setShowPeople(false)} participants={participants} />
      <ChatPanel open={showChat} onClose={() => setShowChat(false)} messages={messages} onSend={sendMessage} />
    </div>
  );
}