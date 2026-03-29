import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useWebRTC } from "../../hooks/useWebRTC.js";
import { useTranslation } from "../../hooks/useTranslation.js";
import VideoGrid from "../../components/VideoGrid.jsx";
import LanguageSelector from "../../components/LanguageSelector.jsx";
import TranslatedCaption from "../../components/TranslatedCaption.jsx";
import "./meetdashboard.css";
import Popup from "./popup.jsx";
import ParticipantsPanel from "./participantspanel.jsx";
import ChatPanel from "./chatpanel.jsx";

export default function MeetDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { meetingId: urlMeetingId } = useParams();
  
  // Debug navigation state
  console.log("Navigation state:", location.state);
  console.log("URL params meetingId:", urlMeetingId);
  
  // Get meeting info from navigation state
  const meetingInfo = location.state || {};
  const { name: userName, mode, micOn: previewMicOn, camOn: previewCamOn, meetingId: stateMeetingId } = meetingInfo;
  
  // Use meeting ID from URL first, then from state
  const meetingId = urlMeetingId || stateMeetingId;
  
  console.log("Meeting info extracted:", meetingInfo);
  console.log("Final meeting ID:", meetingId);
  
  // WebRTC hook - updated to use all new features
  const {
    isConnected,
    participants: rtcParticipants,
    messages: rtcMessages,
    isMuted,
    isVideoOff,
    isScreenSharing,
    handRaised,
    initializeLocalMedia,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    toggleHandRaise,
    sendMessage: rtcSendMessage,
    cleanup,
    setLocalVideoRef,
    localStream
  } = useWebRTC(meetingId, userName, meetingInfo.userId);

  // Translation hook for multi-user real-time translation
  const [tempUserId] = useState(() => 'user_' + Math.random().toString(36).substr(2, 9));
  
  const {
    isConnected: translationConnected,
    currentLanguage,
    availableLanguages,
    caption,
    isListening,
    changeLanguage,
    toggleListening
  } = useTranslation(meetingId, userName, meetingInfo.userId || tempUserId, 'en');

  const [showPopup, setShowPopup] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [meetingSeconds, setMeetingSeconds] = useState(0);
  const [meetingRunning, setMeetingRunning] = useState(true);
  // Use hook state for mic/cam
  const [micOn, setMicOn] = useState(previewMicOn ?? true);
  const [camOn, setCamOn] = useState(previewCamOn ?? false);
  // Use hook state for hand raised
  const [captionsEnabled, setCaptionsEnabled] = useState(true); // Enable by default
  const [captionText, setCaptionText] = useState("");
  const [audioUnlocked, setAudioUnlocked] = useState(false);


  // Initialize local media when connected
  useEffect(() => {
    if (isConnected && userName) {
      console.log("Initializing local media with mic:", camOn, "cam:", micOn);
      initializeLocalMedia(camOn, micOn);
    }
  }, [isConnected, userName, camOn, micOn, initializeLocalMedia]);

  // Debug participant changes
  useEffect(() => {
    console.log("Participants updated:", rtcParticipants);
  }, [rtcParticipants]);

  // Debug WebRTC hook initialization
  useEffect(() => {
    console.log("🔍 WebRTC hook debug - Meeting ID:", meetingId, "User name:", userName);
    console.log("🔍 Should connect to WebRTC:", !!(meetingId && userName));
  }, [meetingId, userName]);

  // Meeting timer
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


  // Cleanup
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Media controls - use hook state
  const handleToggleMic = async () => {
    const newState = await toggleMicrophone();
    setMicOn(!newState);
  };

  const handleToggleCam = async () => {
    const newState = await toggleCamera();
    setCamOn(!newState);
  };

  const handleToggleScreenShare = async () => {
    await toggleScreenShare();
  };

  const handleToggleHandRaise = () => {
    toggleHandRaise();
  };

  const unlockAudio = () => {
    console.log("Force playing audio 🔊");
    if (!audioUnlocked) {
      // Create a proper silent audio file
      const silentAudioData = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAAAQAEAAEAfAAAQAQABAAgAZGF0YQAAAAA=";
      const audio = new Audio(silentAudioData);
      audio.volume = 0.01;
      audio.play().then(() => {
        console.log("Audio unlocked 🔊");
        setAudioUnlocked(true);
        // Clean up the audio element
        audio.pause();
        audio.src = "";
      }).catch(err => {
        console.error("Unlock failed:", err);
        // Try alternative method
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          const audioContext = new AudioContext();
          if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
              console.log("AudioContext resumed 🔊");
              setAudioUnlocked(true);
            });
          }
        } catch (e) {
          console.error("AudioContext failed:", e);
        }
      });
    }
  };

  const playBase64Audio = (base64) => {
    try {
      const audio = new Audio("data:audio/mpeg;base64," + base64);
      audio.volume = 0.8;
      audio.play()
        .then(() => console.log("Playing audio 🔊"))
        .catch(err => console.error("Play error:", err));
    } catch (e) {
      console.error("Audio error:", e);
    }
  };

  const handleEndMeeting = () => {
    cleanup();
    navigate("/");
  };

  const handleSendMessage = (message) => {
    rtcSendMessage(message);
  };

  // Debug function to test connection
  const testConnection = () => {
    console.log("Testing WebRTC connection...");
    console.log("Is connected:", isConnected);
    console.log("Meeting ID:", meetingId);
    console.log("User name:", userName);
    console.log("Participants:", rtcParticipants);
    
    if (!meetingId) {
      console.error("No meeting ID available - cannot connect to WebRTC");
      alert("Meeting ID is missing. Please go back and join the meeting again.");
      return;
    }
    
    // Manual connection test
    console.log("🔧 Manual connection test...");
    const testSocket = io("http://localhost:3001");
    testSocket.on("connect", () => {
      console.log("✅ Manual test socket connected!");
      testSocket.emit("join-room", {
        roomId: meetingId,
        userName: userName + " (test)",
        userId: "test-" + Date.now()
      });
    });
    testSocket.on("connect_error", (err) => {
      console.error("❌ Manual test failed:", err);
    });
    
    // Also test if main socket is connected
    console.log("🔍 Main socket status:", isConnected);
    if (!isConnected) {
      console.log("🔄 Attempting to reconnect...");
      // Trigger reconnection by changing a state
      window.location.reload();
    }
  };

  return (
    <div className="meet-dashboard">
      {/* Header */}
      <div className="meet-header">
        <div className="meet-info">
          <h3>Meeting: {meetingId}</h3>
          <span className="timer">{formatTime(meetingSeconds)}</span>
          <span className={`connection-status ${isConnected ? "connected" : "disconnected"}`}>
            {isConnected ? "🟢 Connected" : "🔴 Connecting..."}
          </span>
        </div>
        
        {/* Language Selector */}
        <LanguageSelector
          currentLanguage={currentLanguage}
          availableLanguages={availableLanguages}
          onChangeLanguage={changeLanguage}
          isListening={isListening}
          onToggleListening={toggleListening}
        />
        
        <div className="meet-controls">
          <button onClick={handleToggleMic} className={`control-btn ${!isMuted ? "active" : "muted"}`}>
            {!isMuted ? "🎤" : "🔇"}
          </button>
          <button onClick={handleToggleCam} className={`control-btn ${!isVideoOff ? "active" : "off"}`}>
            {!isVideoOff ? "📹" : "📵"}
          </button>
          <button onClick={handleToggleScreenShare} className={`control-btn ${isScreenSharing ? "active" : ""}`}>
            🖥️
          </button>
          <button onClick={handleToggleHandRaise} className={`control-btn ${handRaised ? "raised" : ""}`}>
            ✋
          </button>
          <button onClick={() => setCaptionsEnabled(!captionsEnabled)} className={`control-btn ${captionsEnabled ? "active" : ""}`}>
            📝
          </button>
          <button onClick={() => setShowChat(!showChat)} className="control-btn">
            💬
          </button>
          <button onClick={() => setShowPeople(!showPeople)} className="control-btn">
            👥
          </button>
          <button onClick={testConnection} className="control-btn debug">
            🐛
          </button>
          <button onClick={handleEndMeeting} className="control-btn end-call">
            📞
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="meet-content">
        {/* Video Grid */}
        <div className="video-section">
          <VideoGrid 
            participants={rtcParticipants} 
            localStream={localStream}
            userName={userName}
            setLocalVideoRef={setLocalVideoRef}
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            handRaised={handRaised}
          />
          
          {/* Translated Captions */}
          <TranslatedCaption 
            caption={caption}
            isVisible={captionsEnabled}
          />
        </div>

        {/* Side Panels */}
        <div className="side-panels">
          {showPeople && (
            <ParticipantsPanel 
              participants={rtcParticipants}
              onClose={() => setShowPeople(false)}
            />
          )}
          
          {showChat && (
            <ChatPanel 
              messages={rtcMessages}
              onSendMessage={handleSendMessage}
              onClose={() => setShowChat(false)}
            />
          )}
        </div>
      </div>

      {/* Popup */}
      {showPopup && <Popup onClose={() => setShowPopup(false)} />}
    </div>
  );
}
