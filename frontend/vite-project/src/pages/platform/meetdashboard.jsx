import { io } from "socket.io-client";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import "./meetdashboard.css";
import Popup from "./popup.jsx";
import ParticipantsPanel from "./ParticipantsPanel.jsx";
import ChatPanel from "./ChatPanel.jsx";

function RemoteVideoTile({ participant, stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-tile">
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
        {participant?.isHost ? " (Host)" : ""}
        {!participant?.micOn ? " 🔇" : ""}
        {participant?.handRaised ? " ✋" : ""}
        {participant?.isSharing ? " 🖥️" : ""}
      </div>
    </div>
  );
}

export default function MeetDashboard() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastSpokenRef = useRef("");
  const peersRef = useRef({});
  const localStreamRef = useRef(new MediaStream());
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const hasJoinedRef = useRef(false);

  const myName = location.state?.name || "Guest";
  const previewMicOn = location.state?.micOn ?? true;
  const previewCamOn = location.state?.camOn ?? false;
  const initialPreferredLanguage = location.state?.preferredLanguage || "ml-IN";

  const [selectedLanguage, setSelectedLanguage] = useState(initialPreferredLanguage);

  const [showPopup, setShowPopup] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [meetingSeconds, setMeetingSeconds] = useState(0);
  const [meetingRunning, setMeetingRunning] = useState(true);

  const [streamReady, setStreamReady] = useState(false);
  const [micOn, setMicOn] = useState(previewMicOn);
  const [camOn, setCamOn] = useState(previewCamOn);
  const [isSharing, setIsSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [screenWarning, setScreenWarning] = useState(false);

  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionText, setCaptionText] = useState("");

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

  /* ---------------- INITIAL LOCAL MEDIA ---------------- */

  useEffect(() => {
    ensureInitialMedia();

    return () => {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- SOCKET + ROOM JOIN ---------------- */

  useEffect(() => {
    if (!meetingId || !streamReady || hasJoinedRef.current) return;

    socketRef.current = io("http://localhost:5000");
    const socket = socketRef.current;

    socket.on("connect", () => {
      socket.emit(
        "join-room",
        {
          meetingId,
          name: myName,
          password: location.state?.password || "",
          micOn: previewMicOn,
          camOn: previewCamOn,
          preferredLanguage: selectedLanguage,
          createIfMissing: true,
          waitingRoom: location.state?.waitingRoom || false,
          aiAnchor: location.state?.aiAnchor || false,
        },
        (response) => {
          if (!response?.ok) {
            alert(response?.message || "Failed to join room");
            navigate("/start");
            return;
          }

          hasJoinedRef.current = true;
          setSelfSocketId(response.selfSocketId || socket.id);
          setParticipants(response.users || []);
        }
      );
    });

    socket.on("join-error", (payload) => {
      alert(payload?.message || "Failed to join room");
      navigate("/start");
    });

    socket.on("room-users", (users) => {
      setParticipants(users || []);
    });

    socket.on("user-joined", async (user) => {
      if (!user || user.socketId === socket.id) return;

      setParticipants((prev) => {
        const exists = prev.some((p) => p.socketId === user.socketId);
        return exists ? prev : [...prev, user];
      });

      try {
        const pc = createPeerConnection(user.socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("offer", {
          meetingId,
          target: user.socketId,
          sdp: offer,
        });
      } catch (err) {
        console.error("Error creating offer:", err);
      }
    });

    socket.on("user-left", ({ socketId }) => {
      closePeerConnection(socketId);
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    });

    socket.on("participant-updated", (updatedUser) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.socketId === updatedUser.socketId ? { ...p, ...updatedUser } : p
        )
      );
    });

    socket.on("chat-message", (msg) => {
      setMessages((prev) => [...prev, msg]);

      if (!showChat) {
        setUnreadCount((count) => count + 1);
      }
    });

    socket.on("translated-caption", (text) => {
      if (!captionsEnabled) return;
      if (!text || text === lastSpokenRef.current) return;

      lastSpokenRef.current = text;
      setCaptionText(text);
      speakText(text);
    });

    socket.on("offer", async ({ caller, sdp }) => {
      try {
        const pc = createPeerConnection(caller);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("answer", {
          meetingId,
          target: caller,
          sdp: answer,
        });
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    });

    socket.on("answer", async ({ sender, sdp }) => {
      try {
        const pc = peersRef.current[sender];
        if (!pc) return;

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    socket.on("ice-candidate", async ({ sender, candidate }) => {
      try {
        const pc = peersRef.current[sender];
        if (!pc || !candidate) return;

        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    });

    return () => {
      try {
        socket.emit("leave-room", { meetingId });
      } catch (err) {
        console.error("leave-room emit failed:", err);
      }

      Object.keys(peersRef.current).forEach((socketId) => {
        closePeerConnection(socketId);
      });

      socket.off("connect");
      socket.off("join-error");
      socket.off("room-users");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("participant-updated");
      socket.off("chat-message");
      socket.off("translated-caption");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.disconnect();
      hasJoinedRef.current = false;
    };
  }, [
    meetingId,
    streamReady,
    myName,
    navigate,
    previewMicOn,
    previewCamOn,
    selectedLanguage,
    captionsEnabled,
    showChat,
    location.state,
  ]);

  /* ---------------- KEEP LOCAL VIDEO BOUND ---------------- */

  useEffect(() => {
    refreshLocalVideo();
  }, []);

  /* ---------------- TIMER ---------------- */

  useEffect(() => {
    if (!meetingRunning) return;

    const interval = setInterval(() => {
      setMeetingSeconds((s) => s + 1);
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

  /* ---------------- CAMERA ---------------- */

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

  /* ---------------- SCREEN SHARE ---------------- */

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

  /* ---------------- HAND RAISE ---------------- */

  const toggleHandRaise = () => {
    const newValue = !handRaised;
    setHandRaised(newValue);
    syncMyParticipantState({ handRaised: newValue });
  };

  /* ---------------- CHAT ---------------- */

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

  const remoteParticipants = participants.filter(
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
    </div>
  );
}