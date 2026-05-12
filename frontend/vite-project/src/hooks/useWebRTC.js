import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

export const useWebRTC = (roomId, userName, userId) => {
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());

  const [participants, setParticipants] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [speakingUser, setSpeakingUser] = useState(null);

  const currentUserIdRef = useRef(null);

  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  const WEBRTC_URL =
    import.meta.env.VITE_WEBRTC_URL || "http://localhost:3001";

  const applyTranslationAudioMode = useCallback(() => {
    const translationModeOn = window.translationModeOn || false;
    const remoteVideos = document.querySelectorAll("video[id^='video-']");

    remoteVideos.forEach((video) => {
      video.muted = translationModeOn;
      video.volume = translationModeOn ? 0 : 1.0;
    });

    console.log(
      translationModeOn
        ? "Translation ON: original remote audio muted"
        : "Translation OFF: original remote audio unmuted"
    );
  }, []);

  const setupAudioLevelDetection = useCallback((stream, id) => {
    if (!stream || !id || stream.getAudioTracks().length === 0) return;

    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const intervalId = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);

        const average =
          dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

        if (average > 20) {
          setSpeakingUser(id);

          setTimeout(() => {
            setSpeakingUser((prev) => (prev === id ? null : prev));
          }, 500);
        }
      }, 150);

      return () => {
        clearInterval(intervalId);
        source.disconnect();
        audioContext.close();
      };
    } catch (error) {
      console.error("Audio level detection error:", error);
    }
  }, []);

  const createPeerConnection = useCallback(
    async (participantId, isInitiator) => {
      console.log(
        "Creating peer connection for:",
        participantId,
        "isInitiator:",
        isInitiator
      );

      let pc = peerConnectionsRef.current.get(participantId);

      if (pc) return pc;

      pc = new RTCPeerConnection({ iceServers });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      } else {
        console.warn("No local stream available when creating peer connection");
      }

      pc.ontrack = (event) => {
        console.log("Received remote track from:", participantId);

        const remoteStream = event.streams[0];

        if (!remoteStream) {
          console.warn("No remote stream found in track event");
          return;
        }

        console.log("Remote audio tracks:", remoteStream.getAudioTracks().length);
        console.log("Remote video tracks:", remoteStream.getVideoTracks().length);

        setParticipants((prev) =>
          prev.map((p) =>
            p.id === participantId ? { ...p, stream: remoteStream } : p
          )
        );

        const remoteVideo = document.getElementById(`video-${participantId}`);

        if (remoteVideo) {
          remoteVideo.srcObject = remoteStream;

          const translationModeOn = window.translationModeOn || false;
          remoteVideo.muted = translationModeOn;
          remoteVideo.volume = translationModeOn ? 0 : 1.0;

          remoteVideo
            .play()
            .catch((err) =>
              console.warn("Remote video/audio autoplay prevented:", err)
            );
        } else {
          console.warn("Remote video element not found:", participantId);
        }

        setupAudioLevelDetection(remoteStream, participantId);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit("ice-candidate", {
            targetId: participantId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(
          `Peer connection state with ${participantId}:`,
          pc.connectionState
        );
      };

      pc.oniceconnectionstatechange = () => {
        console.log(
          `ICE connection state with ${participantId}:`,
          pc.iceConnectionState
        );
      };

      peerConnectionsRef.current.set(participantId, pc);

      if (isInitiator) {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });

        await pc.setLocalDescription(offer);

        socketRef.current.emit("offer", {
          targetId: participantId,
          offer,
        });
      }

      return pc;
    },
    [setupAudioLevelDetection]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      applyTranslationAudioMode();
    }, 500);

    return () => clearInterval(interval);
  }, [applyTranslationAudioMode]);

  useEffect(() => {
    if (!roomId || !userName) return;

    socketRef.current = io(WEBRTC_URL, {
      transports: ["websocket", "polling"],
      timeout: 10000,
      forceNew: true,
    });

    socketRef.current.on("connect", () => {
      console.log("Socket connected:", socketRef.current.id);

      currentUserIdRef.current = socketRef.current.id;
      setIsConnected(true);

      socketRef.current.emit("join-room", {
        roomId,
        userName,
        userId: userId || socketRef.current.id,
      });
    });

    socketRef.current.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    socketRef.current.on("participants-list", (participantsList) => {
      const otherParticipants = participantsList.filter(
        (p) => p.id !== currentUserIdRef.current
      );

      setParticipants((prev) => {
        const currentUser = prev.find((p) => p.isYou);
        
        // If we have a current user, preserve it and add others
        if (currentUser) {
          return [currentUser, ...otherParticipants];
        }
        
        // If no current user in prev, check if our ID is in the list
        const meInList = participantsList.find((p) => p.id === currentUserIdRef.current);
        if (meInList) {
          return participantsList.map((p) => ({
            ...p,
            isYou: p.id === currentUserIdRef.current
          }));
        }
        
        // Fallback: just use the list as-is
        return participantsList;
      });

      // Create peer connections with any participants we don't have connections with
      participantsList.forEach(async (participant) => {
        if (participant.id !== currentUserIdRef.current && !peerConnectionsRef.current.has(participant.id)) {
          console.log("Creating peer connection with participant from participants-list:", participant.id);
          await createPeerConnection(participant.id, true);
        }
      });
    });

    socketRef.current.on("user-joined", async (participant) => {
      if (participant.id !== currentUserIdRef.current) {
        console.log("User joined:", participant);

        setParticipants((prev) => {
          const exists = prev.some((p) => p.id === participant.id);
          return exists ? prev : [...prev, participant];
        });

        await createPeerConnection(participant.id, true);
      }
    });

    socketRef.current.on("user-left", (data) => {
      const { userId, actualUserId, isRefresh } = data;

      console.log("User left:", data);

      if (peerConnectionsRef.current.has(userId)) {
        peerConnectionsRef.current.get(userId).close();
        peerConnectionsRef.current.delete(userId);
      }

      if (isRefresh && actualUserId) {
        setParticipants((prev) =>
          prev.filter((p) => p.userId !== actualUserId)
        );
      } else {
        setParticipants((prev) => prev.filter((p) => p.id !== userId));
      }
    });

    socketRef.current.on("offer", async ({ fromId, offer }) => {
      try {
        console.log("Received offer from:", fromId);

        const pc = await createPeerConnection(fromId, false);

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketRef.current.emit("answer", {
          targetId: fromId,
          answer,
        });
      } catch (error) {
        console.error("Error handling offer:", error);
      }
    });

    socketRef.current.on("answer", async ({ fromId, answer }) => {
      try {
        console.log("Received answer from:", fromId);

        const pc = peerConnectionsRef.current.get(fromId);

        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } else {
          console.warn("No peer connection found for answer from:", fromId);
        }
      } catch (error) {
        console.error("Error handling answer:", error);
      }
    });

    socketRef.current.on("ice-candidate", async ({ fromId, candidate }) => {
      try {
        console.log("Received ICE candidate from:", fromId);

        const pc = peerConnectionsRef.current.get(fromId);

        if (pc && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          console.warn("No peer connection found for ICE candidate from:", fromId);
        }
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    });

    socketRef.current.on("chat-message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socketRef.current.on(
      "media-state-changed",
      ({ userId, micOn, camOn, isScreenSharing }) => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === userId ? { ...p, micOn, camOn, isScreenSharing } : p
          )
        );
      }
    );

    socketRef.current.on("hand-raised", ({ userId, raised }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === userId ? { ...p, handRaised: raised } : p
        )
      );
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();

      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
    };
  }, [roomId, userName, userId, WEBRTC_URL, createPeerConnection]);

  const initializeLocalMedia = useCallback(
    async (video = true, audio = true) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video,
          audio,
        });

        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
        }

        if (audio) {
          setupAudioLevelDetection(stream, currentUserIdRef.current);
        }

        peerConnectionsRef.current.forEach((pc) => {
          const existingSenders = pc.getSenders();

          stream.getTracks().forEach((track) => {
            const alreadyAdded = existingSenders.some(
              (sender) => sender.track && sender.track.kind === track.kind
            );

            if (!alreadyAdded) pc.addTrack(track, stream);
          });
        });

        setParticipants((prev) => {
          const others = prev.filter((p) => !p.isYou);

          const currentUser = {
            id: currentUserIdRef.current || "local",
            name: userName,
            userName,
            isYou: true,
            micOn: stream.getAudioTracks()[0]?.enabled ?? false,
            camOn: stream.getVideoTracks()[0]?.enabled ?? false,
            isScreenSharing: false,
            handRaised,
            stream,
          };

          return [currentUser, ...others];
        });

        if (socketRef.current) {
          socketRef.current.emit("media-state-change", {
            micOn: stream.getAudioTracks()[0]?.enabled ?? false,
            camOn: stream.getVideoTracks()[0]?.enabled ?? false,
            isScreenSharing: false,
          });
        }

        return stream;
      } catch (error) {
        console.error("Error accessing media devices:", error);
        return null;
      }
    },
    [userName, handRaised, setupAudioLevelDetection]
  );

  const setLocalVideoRef = useCallback((ref) => {
    localVideoRef.current = ref;

    if (ref && localStreamRef.current) {
      ref.srcObject = localStreamRef.current;
      ref.muted = true;
    }
  }, []);

  const toggleMicrophone = useCallback(() => {
    if (!localStreamRef.current) return false;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (!audioTrack) return false;

    audioTrack.enabled = !audioTrack.enabled;

    const micOn = audioTrack.enabled;
    setIsMuted(!micOn);

    setParticipants((prev) =>
      prev.map((p) => (p.isYou ? { ...p, micOn } : p))
    );

    if (socketRef.current) {
      socketRef.current.emit("media-state-change", {
        micOn,
        camOn: !isVideoOff,
        isScreenSharing,
      });
    }

    return micOn;
  }, [isVideoOff, isScreenSharing]);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return false;

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!videoTrack) return false;

    videoTrack.enabled = !videoTrack.enabled;

    const camOn = videoTrack.enabled;
    setIsVideoOff(!camOn);

    setParticipants((prev) =>
      prev.map((p) => (p.isYou ? { ...p, camOn } : p))
    );

    if (socketRef.current) {
      socketRef.current.emit("media-state-change", {
        micOn: !isMuted,
        camOn,
        isScreenSharing,
      });
    }

    return camOn;
  }, [isMuted, isScreenSharing]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (!localStreamRef.current) {
        console.warn("No local stream available for screen sharing");
        return false;
      }

      if (isScreenSharing) {
        const currentAudioTrack = localStreamRef.current.getAudioTracks()[0];

        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        const cameraTrack = cameraStream.getVideoTracks()[0];

        const newStream = new MediaStream();

        if (cameraTrack) newStream.addTrack(cameraTrack);
        if (currentAudioTrack) newStream.addTrack(currentAudioTrack);

        peerConnectionsRef.current.forEach((pc) => {
          const videoSender = pc
            .getSenders()
            .find((sender) => sender.track && sender.track.kind === "video");

          if (videoSender && cameraTrack) videoSender.replaceTrack(cameraTrack);
        });

        localStreamRef.current = newStream;

        if (localVideoRef.current) localVideoRef.current.srcObject = newStream;

        setIsScreenSharing(false);

        if (socketRef.current) {
          socketRef.current.emit("media-state-change", {
            micOn: !isMuted,
            camOn: true,
            isScreenSharing: false,
          });
        }

        return false;
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        const currentAudioTrack = localStreamRef.current.getAudioTracks()[0];

        const newStream = new MediaStream();

        if (screenTrack) newStream.addTrack(screenTrack);
        if (currentAudioTrack) newStream.addTrack(currentAudioTrack);

        peerConnectionsRef.current.forEach((pc) => {
          const videoSender = pc
            .getSenders()
            .find((sender) => sender.track && sender.track.kind === "video");

          if (videoSender && screenTrack) videoSender.replaceTrack(screenTrack);
        });

        screenTrack.onended = async () => {
          const currentAudioTrack = localStreamRef.current?.getAudioTracks()[0];

          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });

          const cameraTrack = cameraStream.getVideoTracks()[0];

          const restoredStream = new MediaStream();

          if (cameraTrack) restoredStream.addTrack(cameraTrack);
          if (currentAudioTrack) restoredStream.addTrack(currentAudioTrack);

          peerConnectionsRef.current.forEach((pc) => {
            const videoSender = pc
              .getSenders()
              .find((sender) => sender.track && sender.track.kind === "video");

            if (videoSender && cameraTrack) videoSender.replaceTrack(cameraTrack);
          });

          localStreamRef.current = restoredStream;

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = restoredStream;
          }

          setIsScreenSharing(false);

          if (socketRef.current) {
            socketRef.current.emit("media-state-change", {
              micOn: !isMuted,
              camOn: true,
              isScreenSharing: false,
            });
          }
        };

        localStreamRef.current = newStream;

        if (localVideoRef.current) localVideoRef.current.srcObject = newStream;

        setIsScreenSharing(true);

        if (socketRef.current) {
          socketRef.current.emit("media-state-change", {
            micOn: !isMuted,
            camOn: true,
            isScreenSharing: true,
          });
        }

        return true;
      }
    } catch (error) {
      console.error("Error toggling screen share:", error);
      return isScreenSharing;
    }
  }, [isScreenSharing, isMuted]);

  const toggleHandRaise = useCallback(() => {
    const newHandRaised = !handRaised;

    setHandRaised(newHandRaised);

    if (socketRef.current) {
      socketRef.current.emit("hand-raise", { raised: newHandRaised });
    }

    setParticipants((prev) =>
      prev.map((p) => (p.isYou ? { ...p, handRaised: newHandRaised } : p))
    );

    return newHandRaised;
  }, [handRaised]);

  const sendMessage = useCallback(
    (message) => {
      if (!socketRef.current) return;

      const messageData = {
        id: Date.now().toString(),
        sender: userName,
        senderId: currentUserIdRef.current,
        text: message,
        timestamp: new Date().toISOString(),
      };

      socketRef.current.emit("chat-message", messageData);
      setMessages((prev) => [...prev, messageData]);
    },
    [userName]
  );

  const cleanup = useCallback(() => {
    if (socketRef.current) socketRef.current.disconnect();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
  }, []);

  return {
    participants,
    isConnected,
    messages,
    isMuted,
    isVideoOff,
    isScreenSharing,
    handRaised,
    speakingUser,
    initializeLocalMedia,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    toggleHandRaise,
    sendMessage,
    cleanup,
    setLocalVideoRef,
    localStream: localStreamRef.current,
  };
};