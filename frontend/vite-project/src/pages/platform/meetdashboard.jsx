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

  const navigate = useNavigate();
  const location = useLocation();

  const previewMicOn = location.state?.micOn ?? true;
  const previewCamOn = location.state?.camOn ?? false;

  const [selectedLanguage, setSelectedLanguage] = useState("ml-IN");

  const [showPopup, setShowPopup] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [meetingSeconds, setMeetingSeconds] = useState(0);
  const [meetingRunning, setMeetingRunning] = useState(true);

  const [stream, setStream] = useState(new MediaStream());
  const [micOn, setMicOn] = useState(previewMicOn);
  const [camOn, setCamOn] = useState(false);

  const [isSharing, setIsSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [screenWarning, setScreenWarning] = useState(false);

  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionText, setCaptionText] = useState("");

  const screenStreamRef = useRef(null);

  /* ---------------- SOCKET ---------------- */

  useEffect(() => {

    socketRef.current = io("http://localhost:5000");

    socketRef.current.on("translated-caption", (text) => {

      if (!captionsEnabled) return;

      if (!text || text === lastSpokenRef.current) return;

      lastSpokenRef.current = text;

      setCaptionText(text);
      speakText(text);
    });

    return () => {
      socketRef.current.off("translated-caption");
      socketRef.current.disconnect();
    };

  }, [captionsEnabled]);

  /* ---------------- VIDEO ---------------- */

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  /* ---------------- TIMER ---------------- */

  useEffect(() => {
    if (!meetingRunning) return;

    const interval = setInterval(() => {
      setMeetingSeconds(s => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [meetingRunning]);

  /* ---------------- SPEECH RECOGNITION ---------------- */

  useEffect(() => {

    if (!captionsEnabled || !micOn) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setCaptionText("");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech Recognition not supported in this browser");
      return;
    }

    if (recognitionRef.current) return;

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {

      if (!micOn) return;

      const text =
        event.results[event.results.length - 1][0].transcript;

      if (socketRef.current?.connected) {
        socketRef.current.emit("speech-text", text);
      }
    };

    recognition.onerror = (e) => {
      console.error("Speech recognition error:", e);
    };

    recognition.onend = () => {
      if (captionsEnabled && micOn) {
        recognition.start();
      }
    };

    recognition.start();
    recognitionRef.current = recognition;

  }, [captionsEnabled, micOn]);

  /* ---------------- CLEANUP ---------------- */

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      speechSynthesis.cancel();
    };
  }, []);

  /* ---------------- MICROPHONE ---------------- */

  const toggleMic = async () => {

    const existingAudio = stream.getAudioTracks()[0];

    if (!existingAudio) {

      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      const audioTrack = audioStream.getAudioTracks()[0];

      stream.addTrack(audioTrack);

      setMicOn(true);
      return;
    }

    existingAudio.enabled = !existingAudio.enabled;
    setMicOn(existingAudio.enabled);
  };

  /* ---------------- CAMERA ---------------- */

  const startCamera = async () => {

    const camStream = await navigator.mediaDevices.getUserMedia({
      video: true
    });

    const videoTrack = camStream.getVideoTracks()[0];

    stream.addTrack(videoTrack);

    setCamOn(true);
  };

  const toggleCam = async () => {

    const existingVideo = stream.getVideoTracks()[0];

    if (!existingVideo) {
      await startCamera();
      return;
    }

    existingVideo.enabled = !existingVideo.enabled;
    setCamOn(existingVideo.enabled);
  };

  /* ---------------- SCREEN SHARE ---------------- */

  const startScreenShare = async () => {

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true
    });

    const screenTrack = displayStream.getVideoTracks()[0];

    const existingVideo = stream.getVideoTracks()[0];

    if (existingVideo) {
      stream.removeTrack(existingVideo);
    }

    stream.addTrack(screenTrack);

    setIsSharing(true);

    screenTrack.onended = () => {
      stopScreenShare();
    };
  };

  const stopScreenShare = () => {

    const screenTrack = stream.getVideoTracks()[0];

    if (screenTrack) {
      stream.removeTrack(screenTrack);
      screenTrack.stop();
    }

    setIsSharing(false);
    startCamera();
  };

  /* ---------------- HAND RAISE ---------------- */

  const toggleHandRaise = () => {
    setHandRaised(prev => !prev);
  };

  /* ---------------- CHAT ---------------- */

  const sendMessage = (text) => {

    const now = new Date();

    const time = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    setMessages(prev => [
      ...prev,
      {
        id: Date.now(),
        sender: "You",
        text,
        time
      }
    ]);

    if (!showChat) {
      setUnreadCount(c => c + 1);
    }
  };

  /* ---------------- VOICE OUTPUT ---------------- */

  const speakText = (text) => {

    if (!text || !captionsEnabled) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = selectedLanguage;
    utterance.rate = 1;
    utterance.pitch = 1;

    speechSynthesis.speak(utterance);
  };

  /* ---------------- END MEETING ---------------- */

  const endMeeting = () => {

    setMeetingRunning(false);

    if (isSharing) {
      stopScreenShare();
    }

    stream.getTracks().forEach(t => t.stop());

    setStream(new MediaStream());

    setCamOn(false);
    setMicOn(false);
    setIsSharing(false);
    setHandRaised(false);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    navigate("/start");
  };

  /* ---------------- UI ---------------- */

  const participants = [
    {
      id: "me",
      name: "You (Host)",
      isYou: true,
      micOn,
      camOn,
      handRaised
    }
  ];

  return (
    <div className="base-container">

      <div className="main-content">

        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="main-video"
          style={{ display: (camOn || isSharing) ? "block" : "none" }}
        />

        {captionsEnabled && (
          <div className="caption-overlay">
            {captionText || "🎤 Listening..."}
          </div>
        )}

        {!camOn && !isSharing && (
          <div className="main-video"></div>
        )}

        <div className="side-videos">
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
        </div>

      </div>

      <div className="controls">

        <button
          className={`control-btn ${micOn ? "" : "off"}`}
          onClick={toggleMic}
        >
          <img src="/src/assets/mic.png" alt="Mic" />
        </button>

        <button
          className={`control-btn ${camOn ? "" : "off"}`}
          onClick={toggleCam}
        >
          <img src="/src/assets/camera.png" alt="Camera" />
        </button>

        <button
          className={`control-btn ${!captionsEnabled ? "off" : ""}`}
          onClick={() => setCaptionsEnabled(prev => !prev)}
        >
          <img src="/src/assets/cc.png" alt="Captions" />
        </button>

        <button
          className={`control-btn ${handRaised ? "off" : ""}`}
          onClick={toggleHandRaise}
        >
          <img src="/src/assets/hand.png" alt="Raise Hand" />
        </button>

        <button className="control-btn" onClick={() => setShowPeople(true)}>
          👥
        </button>

        <button
          className="control-btn chat-btn"
          onClick={() => setShowChat(true)}
        >
          💬
          {unreadCount > 0 && <span className="chat-badge">{unreadCount}</span>}
        </button>

        <button
          className={`control-btn ${isSharing ? "off" : ""}`}
          onClick={isSharing ? stopScreenShare : startScreenShare}
        >
          <img src="/src/assets/share.png" alt="Share" />
        </button>

        <button className="control-btn" onClick={() => setShowPopup(true)}>
          <img src="/src/assets/more.png" alt="More" />
        </button>

        <button className="control-btn end" onClick={endMeeting}>
          <img src="/src/assets/hangup.png" alt="Hang Up" />
        </button>

      </div>

      <Popup open={showPopup} onClose={() => setShowPopup(false)} />

      <ParticipantsPanel
        open={showPeople}
        onClose={() => setShowPeople(false)}
        participants={participants}
      />

      <ChatPanel
        open={showChat}
        onClose={() => setShowChat(false)}
        messages={messages}
        onSend={sendMessage}
      />

      {screenWarning && (
        <div className="screen-warning-popup">
          <div className="popup-content">
            <p>
              ⚠ <strong>Entire Screen sharing is not supported.</strong><br />
              Please select <strong>Chrome Tab</strong> or <strong>Window</strong>.
            </p>
            <button onClick={() => setScreenWarning(false)}>OK</button>
          </div>
        </div>
      )}

    </div>
  );
}