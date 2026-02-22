import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./meetdashboard.css";
import Popup from "./popup.jsx";
import ParticipantsPanel from "./ParticipantsPanel.jsx";
import ChatPanel from "./ChatPanel.jsx";

export default function MeetDashboard() {
  const localVideoRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
const previewMicOn = location.state?.micOn ?? true;
const previewCamOn = location.state?.camOn ?? false;
  const [showPopup, setShowPopup] = useState(false);
    const [showPeople, setShowPeople] = useState(false);
const [showChat, setShowChat] = useState(false);
const [messages, setMessages] = useState([]);
const [unreadCount, setUnreadCount] = useState(0);
const [meetingSeconds, setMeetingSeconds] = useState(0);
const [meetingRunning, setMeetingRunning] = useState(true);





  const [stream, setStream] = useState(null);
  const [micOn, setMicOn] = useState(previewMicOn);
const [camOn, setCamOn] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [screenWarning, setScreenWarning] = useState(false);


const cameraStreamRef = useRef(null);
const screenStreamRef = useRef(null);
const micStreamRef = useRef(null);


  useEffect(() => {
  // Google Meet style: do NOT auto start camera on page load
  return () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };
}, [stream]);
useEffect(() => {
  if (!meetingRunning) return;

  const interval = setInterval(() => {
    setMeetingSeconds((s) => s + 1);
  }, 1000);

  return () => clearInterval(interval);
}, [meetingRunning]);

useEffect(() => {
  if (showChat) {
    setUnreadCount(0);
  }
}, [showChat]);

useEffect(() => {
  if (!location.state) return;

  const applyPreviewSettings = async () => {
    try {
      // Only start camera if previewCamOn is true
      if (previewCamOn === true) {
        await startCamera();
      }

      // Only request mic if previewMicOn is true
      if (previewMicOn === true) {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        micStreamRef.current = audioStream;
        setMicOn(true);
      } else {
        setMicOn(false);
      }

    } catch (err) {
      console.error(err);
    }
  };

  applyPreviewSettings();
}, [location.state]);
    

  const toggleMic = async () => {
  try {
    // If mic stream does not exist → request mic access
    if (!micStreamRef.current) {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      micStreamRef.current = audioStream;
      setMicOn(true);
      return;
    }

    const audioTrack = micStreamRef.current.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setMicOn(audioTrack.enabled);

  } catch (err) {
    console.error(err);
    alert("Microphone permission denied");
  }
};


    const startCamera = async () => {
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false, // do NOT request mic here
    });

    setStream(s);
    cameraStreamRef.current = s;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = s;
    }

    setCamOn(true);

  } catch (err) {
    console.error(err);
  }
};

const toggleCam = async () => {
  try {
    if (!stream) {
      await startCamera();
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    if (camOn) {
      // STOP camera completely
      videoTrack.stop();
      setCamOn(false);
    } else {
      // Restart camera
      await startCamera();
    }
  } catch (err) {
    console.error(err);
  }
};

const startScreenShare = async () => {
  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    screenStreamRef.current = displayStream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = displayStream;
    }

    setIsSharing(true);

    displayStream.getVideoTracks()[0].onended = () => {
      stopScreenShare();
    };

  } catch (err) {
    console.error("Screen share failed:", err);
  }
};



  const stopScreenShare = () => {

  // Stop screen stream
  if (screenStreamRef.current) {
    screenStreamRef.current.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
  }

  // Restore camera
  if (cameraStreamRef.current && localVideoRef.current) {
    localVideoRef.current.srcObject = cameraStreamRef.current;
  }

  setIsSharing(false);
};


const toggleHandRaise = () => {
  setHandRaised((prev) => !prev);
};
const sendMessage = (text) => {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  setMessages((prev) => [
    ...prev,
    {
      id: `${Date.now()}`,
      sender: "You",
      text,
      time,
    },
  ]);

  // ✅ increase unread only if chat is closed
  if (!showChat) {
    setUnreadCount((c) => c + 1);
  }
};


const endMeeting = () => {
  setMeetingRunning(false); 

  // Stop screen sharing if active
  if (isSharing) {
    stopScreenShare();
  }

  // Stop camera + mic tracks
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }

  // ✅ Stop dedicated mic stream
  if (micStreamRef.current) {
    micStreamRef.current.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
  }

  // Reset all states
  setStream(null);
  cameraStreamRef.current = null;

  setCamOn(false);
  setMicOn(false);
  setIsSharing(false);
  setHandRaised(false);

  // Clear video preview
  if (localVideoRef.current) {
    localVideoRef.current.srcObject = null;
  }

  navigate("/start");
};

const formatTime = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
};

const participants = [
  {
    id: "me",
    name: "You (Host)",
    isYou: true,
    micOn,
    camOn,
    handRaised,
  },
];
  return (
    <div className="base-container">
      {/* Top Bar */}
      
      <div className="start-top-bar">
        <img src="/src/assets/logo.png" className="start-logo" />
        <div className="start-menu">
  <span onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
    Home
  </span>

  <span onClick={() => navigate("/meetings")} style={{ cursor: "pointer" }}>
    Meetings
  </span>

  <span onClick={() => navigate("/settings")} style={{ cursor: "pointer" }}>
    Settings
  </span>

  <span onClick={() => navigate("/profile")} style={{ cursor: "pointer" }}>
    Profile
  </span>
</div>



      </div>


      {/* Main Content */}
      <div className="main-content">
        {/* Big video */}
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="main-video"
          style={{ display: (camOn || isSharing) ? "block" : "none" }}

        />

        {!camOn && !isSharing && (
  <div className="main-video" style={{ display: "block" }} />
)}


        {/* Small videos grid */}
        <div className="side-videos">
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="controls">
        <button
          className={`control-btn ${micOn ? "" : "off"}`}
          onClick={toggleMic}
          title={micOn ? "Mute" : "Unmute"}
        >
          <img src="/src/assets/mic.png" alt="Mic" />
        </button>

        <button
          className={`control-btn ${camOn ? "" : "off"}`}
          onClick={toggleCam}
          title={camOn ? "Turn off camera" : "Turn on camera"}
        >
          <img src="/src/assets/camera.png" alt="Camera" />
        </button>

        <button className="control-btn">
          <img src="/src/assets/cc.png" alt="Captions" />
        </button>
        <button
  className={`control-btn ${handRaised ? "off" : ""}`}
  onClick={toggleHandRaise}
  title={handRaised ? "Lower hand" : "Raise hand"}
>
  <img src="/src/assets/hand.png" alt="Raise Hand" />
</button>
<button
  className="control-btn"
  onClick={() => setShowPeople(true)}
  title="People"
>
  👥
</button>
<button
  className="control-btn chat-btn"
  onClick={() => setShowChat(true)}
  title="Chat"
>
  💬
  {unreadCount > 0 && <span className="chat-badge">{unreadCount}</span>}
</button>

        <button
  className={`control-btn ${isSharing ? "off" : ""}`}
  onClick={isSharing ? stopScreenShare : startScreenShare}
  title={isSharing ? "Stop sharing" : "Share screen"}
>
  <img src="/src/assets/share.png" alt="Share" />
</button>


        
  
        
          
        <button
  className="control-btn"
  onClick={() => setShowPopup(true)}
>
  <img src="/src/assets/more.png" alt="More" />
</button>

        <button
  className="control-btn end"
  onClick={endMeeting}
  title="Leave call"
>
  <img src="/src/assets/hangup.png" alt="Hang Up" />
</button>

      </div>
      <Popup
  open={showPopup}
  onClose={() => setShowPopup(false)}
/>
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
