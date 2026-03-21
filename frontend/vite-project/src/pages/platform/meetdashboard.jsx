import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
<<<<<<< HEAD
import { socket } from "../../socket";
=======
import { io } from "socket.io-client";
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
import "./meetdashboard.css";
import Popup from "./popup.jsx";
import ParticipantsPanel from "./ParticipantsPanel.jsx";
import ChatPanel from "./ChatPanel.jsx";

<<<<<<< HEAD
function RemoteVideoTile({ participant, stream }) {
=======
function RemoteVideoTile({ stream, label = "Participant" }) {
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
<<<<<<< HEAD
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
=======
      console.log("RemoteVideoTile stream updated:", label, stream);
    }
  }, [stream, label]);

  return (
    <div className="video-tile" style={{ position: "relative", overflow: "hidden" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          left: 8,
          bottom: 8,
          background: "rgba(0,0,0,0.5)",
          color: "white",
          padding: "2px 8px",
          borderRadius: 8,
          fontSize: 12,
        }}
      >
        {label}
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
      </div>
    </div>
  );
}

export default function MeetDashboard() {
<<<<<<< HEAD
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const socketRef = useRef(socket);
  const localVideoRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastSpokenRef = useRef("");
  const peersRef = useRef({});
  const localStreamRef = useRef(new MediaStream());
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);

  const myName = location.state?.name || "Guest";
  const previewMicOn = location.state?.micOn ?? true;
  const previewCamOn = location.state?.camOn ?? false;
  const initialPreferredLanguage = location.state?.preferredLanguage || "ml-IN";

  const [selectedLanguage, setSelectedLanguage] = useState(initialPreferredLanguage);

=======

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
const previewMicOn = location.state?.micOn ?? true;
const previewCamOn = location.state?.camOn ?? false;
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
  const [showPopup, setShowPopup] = useState(false);
    const [showPeople, setShowPeople] = useState(false);
const [showChat, setShowChat] = useState(false);
const [messages, setMessages] = useState([]);
const [unreadCount, setUnreadCount] = useState(0);
const [meetingSeconds, setMeetingSeconds] = useState(0);
const [meetingRunning, setMeetingRunning] = useState(true);



<<<<<<< HEAD
  const [streamReady, setStreamReady] = useState(false);
  const [micOn, setMicOn] = useState(previewMicOn);
  const [camOn, setCamOn] = useState(previewCamOn);
=======


  const [stream, setStream] = useState(null);
  const [micOn, setMicOn] = useState(previewMicOn);
const [camOn, setCamOn] = useState(false);
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
  const [isSharing, setIsSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [screenWarning, setScreenWarning] = useState(false);


<<<<<<< HEAD
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
      if (state === "failed" || state === "closed" || state === "disconnected") {
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

  useEffect(() => {
    ensureInitialMedia();

    return () => {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!meetingId || !streamReady) return;

    const currentSocket = socketRef.current;

    if (!currentSocket.connected) {
      currentSocket.connect();
    }

    setSelfSocketId(currentSocket.id || null);

    const handleConnect = () => {
      setSelfSocketId(currentSocket.id || null);
      console.log("Shared socket connected in MeetDashboard:", currentSocket.id);
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
    };
  }, [
    meetingId,
    streamReady,
    navigate,
    showChat,
    captionsEnabled,
  ]);

  useEffect(() => {
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
=======
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
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
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

<<<<<<< HEAD
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

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      speechSynthesis.cancel();
    };
  }, []);

  const toggleMic = async () => {
    try {
      let audioTrack = localStreamRef.current.getAudioTracks()[0];

      if (!audioTrack) {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
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
=======
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

      await replaceVideoTrackForPeers(screenTrack);
      setIsSharing(true);
      setCamOn(true);

    displayStream.getVideoTracks()[0].onended = () => {
      stopScreenShare();
    };

  } catch (err) {
    console.error("Screen share failed:", err);
  }
};


>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e

  const stopScreenShare = async () => {
    try {
      const activeScreenTrack = screenTrackRef.current;

<<<<<<< HEAD
      if (activeScreenTrack) {
        localStreamRef.current.removeTrack(activeScreenTrack);
        activeScreenTrack.stop();
        screenTrackRef.current = null;
      }

      if (cameraTrackRef.current && cameraTrackRef.current.readyState === "live") {
        localStreamRef.current.addTrack(cameraTrackRef.current);
        await replaceVideoTrackForAllPeers(cameraTrackRef.current);
        setCamOn(cameraTrackRef.current.enabled);
      } else {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
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
=======
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
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    navigate("/start");
  };

<<<<<<< HEAD
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
=======
const formatTime = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e

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
<<<<<<< HEAD
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
=======
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
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e

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

<<<<<<< HEAD
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
=======
        {!camOn && !isSharing && (
  <div className="main-video" style={{ display: "block" }} />
)}

        <div className="side-videos">
          {remoteVideos.length === 0 ? (
            <>
              <div className="video-tile"></div>
              <div className="video-tile"></div>
              <div className="video-tile"></div>
              <div className="video-tile"></div>
            </>
          ) : (
            remoteVideos.map((video) => (
              <RemoteVideoTile
                key={video.socketId}
                stream={video.stream}
                label={video.name}
              />
            ))
          )}
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
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
<<<<<<< HEAD
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
=======
  className={`control-btn ${isSharing ? "off" : ""}`}
  onClick={isSharing ? stopScreenShare : startScreenShare}
  title={isSharing ? "Stop sharing" : "Share screen"}
>
  <img src="/src/assets/share.png" alt="Share" />
</button>
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e

        <button className="control-btn" onClick={() => setShowPopup(true)}>
          <img src="/src/assets/more.png" alt="More" />
        </button>

<<<<<<< HEAD
        <button className="control-btn end" onClick={endMeeting}>
          <img src="/src/assets/hangup.png" alt="Hang Up" />
        </button>
=======
        <button
  className="control-btn end"
  onClick={endMeeting}
  title="Leave call"
>
  <img src="/src/assets/hangup.png" alt="Hang Up" />
</button>

>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
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

<<<<<<< HEAD
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
              Please select <strong>Chrome Tab</strong> or <strong>Window</strong>.
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

            <button onClick={() => setScreenWarning(false)} style={{ marginTop: "12px" }}>
              OK
            </button>
          </div>
        </div>
      )}
=======

>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
    </div>
  );
}