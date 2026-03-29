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

function RemoteVideoTile({ participant, stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-tile" style={{ position: "relative" }}>
      {participant?.camOn && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="tile-video"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          className="tile-placeholder"
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1f1f1f",
            color: "white",
            fontSize: "14px",
            textAlign: "center",
            padding: "8px",
          }}
        >
          {participant?.name || "Participant"}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: "8px",
          bottom: "8px",
          background: "rgba(0,0,0,0.55)",
          color: "white",
          padding: "4px 8px",
          borderRadius: "8px",
          fontSize: "12px",
        }}
      >
        {participant?.name}
        {participant?.isYou ? " (You)" : ""}
        {participant?.isHost ? " (Host)" : ""}
        {!participant?.micOn ? " 🔇" : ""}
        {participant?.handRaised ? " ✋" : ""}
        {participant?.isSharing ? " 🖥️" : ""}
      </div>
    </div>
  );
}

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

<<<<<<< HEAD
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
=======
  const socketRef = useRef(socket);
  const localVideoRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastSpokenRef = useRef("");
  const peersRef = useRef({});
  const localStreamRef = useRef(new MediaStream());
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const hasRoomActionRunRef = useRef(false);

  const mode = location.state?.mode || "join";
  const myName = location.state?.name || "Guest";
  const password = (location.state?.password || "").trim();
  const previewMicOn = location.state?.micOn ?? true;
  const previewCamOn = location.state?.camOn ?? false;
  const initialPreferredLanguage = location.state?.preferredLanguage || "ml-IN";
  const waitingRoom = location.state?.waitingRoom || false;
  const aiAnchor = location.state?.aiAnchor || false;

  const [selectedLanguage, setSelectedLanguage] = useState(
    initialPreferredLanguage
  );
>>>>>>> e2b53a2fcfa4f2d4a5c44f49684f9ccbf0145e4b

  const [showPopup, setShowPopup] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [meetingSeconds, setMeetingSeconds] = useState(0);
  const [meetingRunning, setMeetingRunning] = useState(true);
<<<<<<< HEAD
  // Use hook state for mic/cam
  const [micOn, setMicOn] = useState(previewMicOn ?? true);
  const [camOn, setCamOn] = useState(previewCamOn ?? false);
  // Use hook state for hand raised
  const [captionsEnabled, setCaptionsEnabled] = useState(true); // Enable by default
=======

  const [streamReady, setStreamReady] = useState(false);
  const [micOn, setMicOn] = useState(previewMicOn);
  const [camOn, setCamOn] = useState(previewCamOn);
  const [isSharing, setIsSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [screenWarning, setScreenWarning] = useState(false);

  const [captionsEnabled, setCaptionsEnabled] = useState(false);
>>>>>>> e2b53a2fcfa4f2d4a5c44f49684f9ccbf0145e4b
  const [captionText, setCaptionText] = useState("");
  const [audioUnlocked, setAudioUnlocked] = useState(false);

<<<<<<< HEAD
=======
  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [selfSocketId, setSelfSocketId] = useState(null);

  const refreshLocalVideo = () => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  };

  const syncMyParticipantState = (overrides = {}) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit("participant-update", {
      meetingId,
      micOn: overrides.micOn ?? micOn,
      camOn: overrides.camOn ?? camOn,
      handRaised: overrides.handRaised ?? handRaised,
      isSharing: overrides.isSharing ?? isSharing,
      preferredLanguage: overrides.preferredLanguage ?? selectedLanguage,
    });
  };

  const closePeerConnection = (socketId) => {
    const pc = peersRef.current[socketId];
    if (pc) {
      try {
        pc.close();
      } catch (err) {
        console.error("Error closing peer connection:", err);
      }
      delete peersRef.current[socketId];
    }

    setRemoteStreams((prev) => {
      const copy = { ...prev };
      delete copy[socketId];
      return copy;
    });
  };

  const createPeerConnection = (remoteSocketId) => {
    if (peersRef.current[remoteSocketId]) {
      return peersRef.current[remoteSocketId];
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.connected) {
        socketRef.current.emit("ice-candidate", {
          meetingId,
          target: remoteSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setRemoteStreams((prev) => ({
        ...prev,
        [remoteSocketId]: remoteStream,
      }));
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (
        state === "failed" ||
        state === "closed" ||
        state === "disconnected"
      ) {
        closePeerConnection(remoteSocketId);
      }
    };

    peersRef.current[remoteSocketId] = pc;
    return pc;
  };

  const addTrackToAllPeers = (track) => {
    Object.values(peersRef.current).forEach((pc) => {
      const alreadySending = pc
        .getSenders()
        .some((sender) => sender.track && sender.track.id === track.id);

      if (!alreadySending) {
        pc.addTrack(track, localStreamRef.current);
      }
    });
  };

  const replaceVideoTrackForAllPeers = async (newTrack) => {
    const allPeerConnections = Object.values(peersRef.current);

    for (const pc of allPeerConnections) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(newTrack);
      } else {
        pc.addTrack(newTrack, localStreamRef.current);
      }
    }
  };

  const ensureInitialMedia = async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: previewMicOn,
        video: previewCamOn,
      });

      localStreamRef.current = media;

      const initialAudioTrack = media.getAudioTracks()[0];
      const initialVideoTrack = media.getVideoTracks()[0];

      if (initialAudioTrack) {
        initialAudioTrack.enabled = previewMicOn;
      }

      if (initialVideoTrack) {
        initialVideoTrack.enabled = previewCamOn;
        cameraTrackRef.current = initialVideoTrack;
      }

      setMicOn(!!initialAudioTrack && previewMicOn);
      setCamOn(!!initialVideoTrack && previewCamOn);

      refreshLocalVideo();
      setStreamReady(true);
    } catch (err) {
      console.error("Failed to get initial media:", err);
      localStreamRef.current = new MediaStream();
      refreshLocalVideo();
      setMicOn(false);
      setCamOn(false);
      setStreamReady(true);
    }
  };
>>>>>>> e2b53a2fcfa4f2d4a5c44f49684f9ccbf0145e4b

  // Initialize local media when connected
  useEffect(() => {
<<<<<<< HEAD
    if (isConnected && userName) {
      console.log("Initializing local media with mic:", camOn, "cam:", micOn);
      initializeLocalMedia(camOn, micOn);
    }
  }, [isConnected, userName, camOn, micOn, initializeLocalMedia]);
=======
    ensureInitialMedia();

    return () => {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!meetingId || !streamReady) return;

    const currentSocket = socketRef.current;

    const doRoomAction = () => {
      if (hasRoomActionRunRef.current) return;
      hasRoomActionRunRef.current = true;

      setSelfSocketId(currentSocket.id || null);

      const payload =
        mode === "create"
          ? {
              meetingId,
              password,
              waitingRoom,
              aiAnchor,
              hostName: myName,
              micOn: previewMicOn,
              camOn: previewCamOn,
              preferredLanguage: initialPreferredLanguage,
            }
          : {
              meetingId,
              password,
              name: myName,
              micOn: previewMicOn,
              camOn: previewCamOn,
              preferredLanguage: initialPreferredLanguage,
              createIfMissing: false,
            };

      const eventName = mode === "create" ? "create-room" : "join-room";

      console.log("MeetDashboard room action:", {
        eventName,
        mode,
        meetingId,
        password,
        name: myName,
      });

      currentSocket.emit(eventName, payload, (response) => {
        console.log(`${eventName} response:`, response);

        if (!response?.ok) {
          alert(response?.message || "Failed to enter meeting");
          navigate("/start");
          return;
        }

        setSelfSocketId(response.selfSocketId || currentSocket.id);
        setParticipants(response.users || []);
      });
    };

    const handleConnect = () => {
      console.log("Socket connected in MeetDashboard:", currentSocket.id);
      doRoomAction();
    };

    const handleJoinError = (payload) => {
      console.log("join-error:", payload);
      alert(payload?.message || "Meeting connection problem");
      navigate("/start");
    };

    const handleRoomUsers = (users) => {
      console.log("room-users received:", users);
      setParticipants(users || []);
    };

    const handleUserJoined = async (user) => {
      console.log("user-joined received:", user);

      if (!user || user.socketId === currentSocket.id) return;

      setParticipants((prev) => {
        const exists = prev.some((p) => p.socketId === user.socketId);
        return exists ? prev : [...prev, user];
      });

      try {
        const pc = createPeerConnection(user.socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        currentSocket.emit("offer", {
          meetingId,
          target: user.socketId,
          sdp: offer,
        });
      } catch (err) {
        console.error("Error creating offer:", err);
      }
    };

    const handleUserLeft = ({ socketId }) => {
      closePeerConnection(socketId);
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    };

    const handleParticipantUpdated = (updatedUser) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.socketId === updatedUser.socketId ? { ...p, ...updatedUser } : p
        )
      );
    };

    const handleChatMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (!showChat) {
        setUnreadCount((count) => count + 1);
      }
    };

    const handleTranslatedCaption = (text) => {
      if (!captionsEnabled) return;
      if (!text || text === lastSpokenRef.current) return;

      lastSpokenRef.current = text;
      setCaptionText(text);
      speakText(text);
    };

    const handleOffer = async ({ caller, sdp }) => {
      try {
        const pc = createPeerConnection(caller);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        currentSocket.emit("answer", {
          meetingId,
          target: caller,
          sdp: answer,
        });
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    };

    const handleAnswer = async ({ sender, sdp }) => {
      try {
        const pc = peersRef.current[sender];
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    };

    const handleIceCandidate = async ({ sender, candidate }) => {
      try {
        const pc = peersRef.current[sender];
        if (!pc || !candidate) return;
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    };

    currentSocket.on("connect", handleConnect);
    currentSocket.on("join-error", handleJoinError);
    currentSocket.on("room-users", handleRoomUsers);
    currentSocket.on("user-joined", handleUserJoined);
    currentSocket.on("user-left", handleUserLeft);
    currentSocket.on("participant-updated", handleParticipantUpdated);
    currentSocket.on("chat-message", handleChatMessage);
    currentSocket.on("translated-caption", handleTranslatedCaption);
    currentSocket.on("offer", handleOffer);
    currentSocket.on("answer", handleAnswer);
    currentSocket.on("ice-candidate", handleIceCandidate);

    if (!currentSocket.connected) {
      currentSocket.connect();
    } else {
      handleConnect();
    }

    return () => {
      currentSocket.off("connect", handleConnect);
      currentSocket.off("join-error", handleJoinError);
      currentSocket.off("room-users", handleRoomUsers);
      currentSocket.off("user-joined", handleUserJoined);
      currentSocket.off("user-left", handleUserLeft);
      currentSocket.off("participant-updated", handleParticipantUpdated);
      currentSocket.off("chat-message", handleChatMessage);
      currentSocket.off("translated-caption", handleTranslatedCaption);
      currentSocket.off("offer", handleOffer);
      currentSocket.off("answer", handleAnswer);
      currentSocket.off("ice-candidate", handleIceCandidate);
      hasRoomActionRunRef.current = false;
    };
  }, [
    meetingId,
    streamReady,
    mode,
    myName,
    password,
    previewMicOn,
    previewCamOn,
    initialPreferredLanguage,
    waitingRoom,
    aiAnchor,
    navigate,
    showChat,
    captionsEnabled,
  ]);
>>>>>>> e2b53a2fcfa4f2d4a5c44f49684f9ccbf0145e4b

  // Debug participant changes
  useEffect(() => {
<<<<<<< HEAD
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
=======
    refreshLocalVideo();
  }, []);

  useEffect(() => {
    if (!meetingRunning) return;

    const interval = setInterval(() => {
      setMeetingSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [meetingRunning]);

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

      const text = event.results[event.results.length - 1][0].transcript;

      if (socketRef.current?.connected) {
        socketRef.current.emit("speech-text", text);
      }
    };

    recognition.onerror = (e) => {
      console.error("Speech recognition error:", e);
    };

    recognition.onend = () => {
      if (captionsEnabled && micOn) {
        try {
          recognition.start();
        } catch (err) {
          console.error("Recognition restart failed:", err);
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error("Recognition start failed:", err);
    }
  }, [captionsEnabled, micOn]);

>>>>>>> e2b53a2fcfa4f2d4a5c44f49684f9ccbf0145e4b
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

<<<<<<< HEAD
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
=======
  const toggleMic = async () => {
    try {
      let audioTrack = localStreamRef.current.getAudioTracks()[0];

      if (!audioTrack) {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        audioTrack = audioStream.getAudioTracks()[0];
        localStreamRef.current.addTrack(audioTrack);
        addTrackToAllPeers(audioTrack);
        refreshLocalVideo();
        setMicOn(true);
        syncMyParticipantState({ micOn: true });
        return;
      }

      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
      syncMyParticipantState({ micOn: audioTrack.enabled });
    } catch (err) {
      console.error("Microphone toggle error:", err);
    }
  };

  const startCamera = async () => {
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      const videoTrack = camStream.getVideoTracks()[0];

      cameraTrackRef.current = videoTrack;

      const existingVideoTracks = localStreamRef.current.getVideoTracks();
      existingVideoTracks.forEach((track) => {
        localStreamRef.current.removeTrack(track);
      });

      localStreamRef.current.addTrack(videoTrack);
      await replaceVideoTrackForAllPeers(videoTrack);

      videoTrack.enabled = true;
      setCamOn(true);
      refreshLocalVideo();
      syncMyParticipantState({ camOn: true, isSharing: false });
    } catch (err) {
      console.error("Start camera error:", err);
    }
  };

  const toggleCam = async () => {
    try {
      const existingVideo = localStreamRef.current
        .getVideoTracks()
        .find((track) => track !== screenTrackRef.current);

      if (!existingVideo) {
        await startCamera();
        return;
      }

      existingVideo.enabled = !existingVideo.enabled;
      setCamOn(existingVideo.enabled);
      syncMyParticipantState({ camOn: existingVideo.enabled });
    } catch (err) {
      console.error("Camera toggle error:", err);
    }
  };

  const startScreenShare = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      const screenTrack = displayStream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;

      const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (currentVideoTrack && currentVideoTrack !== screenTrack) {
        cameraTrackRef.current = currentVideoTrack;
        localStreamRef.current.removeTrack(currentVideoTrack);
      }

      localStreamRef.current.addTrack(screenTrack);
      await replaceVideoTrackForAllPeers(screenTrack);

      setIsSharing(true);
      setCamOn(true);
      refreshLocalVideo();
      syncMyParticipantState({ isSharing: true, camOn: true });

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Screen share error:", err);

      if (
        String(err?.message || "").toLowerCase().includes("screen") ||
        String(err?.message || "").toLowerCase().includes("display")
      ) {
        setScreenWarning(true);
      }
    }
  };

  const stopScreenShare = async () => {
    try {
      const activeScreenTrack = screenTrackRef.current;

      if (activeScreenTrack) {
        localStreamRef.current.removeTrack(activeScreenTrack);
        activeScreenTrack.stop();
        screenTrackRef.current = null;
      }

      if (
        cameraTrackRef.current &&
        cameraTrackRef.current.readyState === "live"
      ) {
        localStreamRef.current.addTrack(cameraTrackRef.current);
        await replaceVideoTrackForAllPeers(cameraTrackRef.current);
        setCamOn(cameraTrackRef.current.enabled);
      } else {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          const newCameraTrack = camStream.getVideoTracks()[0];
          cameraTrackRef.current = newCameraTrack;
          localStreamRef.current.addTrack(newCameraTrack);
          await replaceVideoTrackForAllPeers(newCameraTrack);
          setCamOn(true);
        } catch (err) {
          console.error("Unable to restore camera after screen share:", err);
          setCamOn(false);
        }
      }

      setIsSharing(false);
      refreshLocalVideo();
      syncMyParticipantState({ isSharing: false, camOn: true });
    } catch (err) {
      console.error("Stop screen share error:", err);
    }
  };

  const toggleHandRaise = () => {
    const newValue = !handRaised;
    setHandRaised(newValue);
    syncMyParticipantState({ handRaised: newValue });
  };

  const sendMessage = (text) => {
    if (!text?.trim()) return;
    if (!socketRef.current?.connected) return;

    const now = new Date();
    const time = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    socketRef.current.emit("chat-message", {
      meetingId,
      text,
      time,
    });
  };

  const speakText = (text) => {
    if (!text || !captionsEnabled) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLanguage;
    utterance.rate = 1;
    utterance.pitch = 1;

    speechSynthesis.speak(utterance);
  };

  const endMeeting = async () => {
    setMeetingRunning(false);

    try {
      if (isSharing) {
        await stopScreenShare();
      }
    } catch (err) {
      console.error(err);
    }

    localStreamRef.current.getTracks().forEach((track) => track.stop());

    Object.keys(peersRef.current).forEach((socketId) => {
      closePeerConnection(socketId);
    });

    if (socketRef.current?.connected) {
      socketRef.current.emit("leave-room", { meetingId });
      socketRef.current.disconnect();
    }

    setCamOn(false);
    setMicOn(false);
    setIsSharing(false);
    setHandRaised(false);
    setParticipants([]);
    setRemoteStreams({});

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    navigate("/start");
  };

  const formattedTime = new Date(meetingSeconds * 1000)
    .toISOString()
    .substring(11, 19);

  const participantsWithSelf = participants.map((p) => ({
    ...p,
    isYou: p.socketId === selfSocketId,
  }));

  const remoteParticipants = participantsWithSelf.filter(
    (p) => p.socketId && p.socketId !== selfSocketId
  );

  return (
    <div className="base-container">
      <div className="main-content">
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="main-video"
            style={{
              display: camOn || isSharing ? "block" : "none",
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          {captionsEnabled && (
            <div className="caption-overlay">
              {captionText || "🎤 Listening..."}
            </div>
          )}

          {!camOn && !isSharing && (
            <div
              className="main-video"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#1f1f1f",
                color: "white",
                fontSize: "18px",
              }}
            >
              {myName}
            </div>
          )}

          <div
            style={{
              position: "absolute",
              left: "12px",
              top: "12px",
              background: "rgba(0,0,0,0.55)",
              color: "white",
              padding: "6px 10px",
              borderRadius: "10px",
              fontSize: "13px",
              zIndex: 3,
            }}
          >
            {myName} {handRaised ? "✋" : ""} {!micOn ? "🔇" : ""}{" "}
            {isSharing ? "🖥️ Sharing" : ""}
          </div>

          <div
            style={{
              position: "absolute",
              right: "12px",
              top: "12px",
              background: "rgba(0,0,0,0.55)",
              color: "white",
              padding: "6px 10px",
              borderRadius: "10px",
              fontSize: "13px",
              zIndex: 3,
            }}
          >
            {formattedTime}
          </div>
        </div>

        <div className="side-videos">
          {remoteParticipants.length === 0 ? (
            <div
              className="video-tile"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                background: "#1f1f1f",
              }}
            >
              Waiting for others to join...
            </div>
          ) : (
            remoteParticipants.map((participant) => (
              <RemoteVideoTile
                key={participant.socketId}
                participant={participant}
                stream={remoteStreams[participant.socketId]}
              />
            ))
          )}
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
          onClick={() => setCaptionsEnabled((prev) => !prev)}
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
          onClick={() => {
            setShowChat(true);
            setUnreadCount(0);
          }}
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
        participants={participantsWithSelf}
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
              ⚠ <strong>Entire Screen sharing is not supported.</strong>
              <br />
              Please select <strong>Chrome Tab</strong> or{" "}
              <strong>Window</strong>.
            </p>

            <div style={{ marginTop: "12px" }}>
              <label style={{ color: "white", marginRight: "8px" }}>
                Voice language:
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  const lang = e.target.value;
                  setSelectedLanguage(lang);
                  syncMyParticipantState({ preferredLanguage: lang });
                }}
              >
                <option value="en-US">English</option>
                <option value="hi-IN">Hindi</option>
                <option value="ml-IN">Malayalam</option>
                <option value="ta-IN">Tamil</option>
              </select>
            </div>

            <button
              onClick={() => setScreenWarning(false)}
              style={{ marginTop: "12px" }}
            >
              OK
            </button>
          </div>
        </div>
      )}
>>>>>>> e2b53a2fcfa4f2d4a5c44f49684f9ccbf0145e4b
    </div>
  );
}
