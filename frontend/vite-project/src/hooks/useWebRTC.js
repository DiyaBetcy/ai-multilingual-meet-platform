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
  const currentUserIdRef = useRef(null);

  // ICE servers configuration
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ];

  // Initialize socket connection
  useEffect(() => {
    if (!roomId || !userName) return;

    socketRef.current = io("http://localhost:3001", {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    });
    
    socketRef.current.on("connect", () => {
      currentUserIdRef.current = socketRef.current.id;
      setIsConnected(true);
      socketRef.current.emit("join-room", {
        roomId,
        userName,
        userId: userId || socketRef.current.id
      });
    });

    socketRef.current.on("disconnect", () => {
      setIsConnected(false);
    });

    // Handle participants list
    socketRef.current.on("participants-list", (participantsList) => {
      const otherParticipants = participantsList.filter(p => p.id !== currentUserIdRef.current);
      setParticipants(prev => {
        const currentUser = prev.find(p => p.isYou);
        return currentUser ? [currentUser, ...otherParticipants] : otherParticipants;
      });
    });

    // Handle new user joining
    socketRef.current.on("user-joined", (participant) => {
      if (participant.id !== currentUserIdRef.current) {
        createPeerConnection(participant.id, true);
        setParticipants(prev => [...prev, participant]);
      }
    });

    // Handle user leaving
    socketRef.current.on("user-left", (participantId) => {
      if (peerConnectionsRef.current.has(participantId)) {
        peerConnectionsRef.current.get(participantId).close();
        peerConnectionsRef.current.delete(participantId);
      }
      setParticipants(prev => prev.filter(p => p.id !== participantId));
    });

    // Handle WebRTC signaling
    socketRef.current.on("offer", async ({ senderId, offer }) => {
      const pc = createPeerConnection(senderId, false);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit("answer", { targetId: senderId, answer });
    });

    socketRef.current.on("answer", async ({ senderId, answer }) => {
      const pc = peerConnectionsRef.current.get(senderId);
      if (pc) {
        await pc.setRemoteDescription(answer);
      }
    });

    socketRef.current.on("ice-candidate", async ({ senderId, candidate }) => {
      const pc = peerConnectionsRef.current.get(senderId);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    // Handle chat messages
    socketRef.current.on("chat-message", (message) => {
      setMessages(prev => [...prev, message]);
    });

    // Handle media state changes
    socketRef.current.on("media-state-changed", ({ userId, mediaState }) => {
      setParticipants(prev => prev.map(p => 
        p.id === userId ? { ...p, ...mediaState } : p
      ));
    });

    // Handle hand raise
    socketRef.current.on("hand-raised", ({ userId, raised }) => {
      setParticipants(prev => prev.map(p => 
        p.id === userId ? { ...p, handRaised: raised } : p
      ));
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      peerConnectionsRef.current.forEach(pc => pc.close());
    };
  }, [roomId, userName, userId]);

  // Create peer connection
  const createPeerConnection = useCallback(async (participantId, isInitiator) => {
    const pc = new RTCPeerConnection({ iceServers });
    
    // Add local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      const remoteVideo = document.getElementById(`video-${participantId}`);
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          targetId: participantId,
          candidate: event.candidate
        });
      }
    };

    peerConnectionsRef.current.set(participantId, pc);

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit("offer", {
        targetId: participantId,
        offer
      });
    }

    return pc;
  }, []);

  // Initialize local media
  const initializeLocalMedia = useCallback(async (video = true, audio = true) => {
    try {
      // Ensure at least one of audio or video is requested
      const requestVideo = video || audio === false;
      const requestAudio = audio || video === false;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: requestVideo,
        audio: requestAudio
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Update current user in participants
      setParticipants(prev => {
        const others = prev.filter(p => !p.isYou);
        const currentUser = {
          id: currentUserIdRef.current || 'local',
          name: userName,
          userName: userName,
          isYou: true,
          micOn: !isMuted,
          camOn: !isVideoOff,
          isScreenSharing: false,
          handRaised: handRaised
        };
        return [currentUser, ...others];
      });

      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      return null;
    }
  }, [userName, isMuted, isVideoOff, handRaised]);

  // Set local video ref
  const setLocalVideoRef = useCallback((ref) => {
    localVideoRef.current = ref;
    if (ref && localStreamRef.current) {
      ref.srcObject = localStreamRef.current;
    }
  }, []);

  // Toggle microphone
  const toggleMicrophone = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        
        // Notify others
        if (socketRef.current) {
          socketRef.current.emit("media-state-change", {
            micOn: audioTrack.enabled,
            camOn: !isVideoOff
          });
        }
        return audioTrack.enabled;
      }
    }
    return false;
  }, [isVideoOff]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        
        // Notify others
        if (socketRef.current) {
          socketRef.current.emit("media-state-change", {
            micOn: !isMuted,
            camOn: videoTrack.enabled
          });
        }
        return videoTrack.enabled;
      }
    }
    return false;
  }, [isMuted]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        const screenTrack = localStreamRef.current.getVideoTracks()[0];
        if (screenTrack) {
          screenTrack.stop();
        }
        
        // Get camera back
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoTrack = stream.getVideoTracks()[0];
        
        // Replace track in all peer connections
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        setIsScreenSharing(false);
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Replace track in all peer connections
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });
        
        screenTrack.onended = () => {
          toggleScreenShare();
        };
        
        localStreamRef.current = screenStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        setIsScreenSharing(true);
      }
      
      return !isScreenSharing;
    } catch (error) {
      console.error("Error toggling screen share:", error);
      return false;
    }
  }, [isScreenSharing]);

  // Toggle hand raise
  const toggleHandRaise = useCallback(() => {
    const newHandRaised = !handRaised;
    setHandRaised(newHandRaised);
    
    if (socketRef.current) {
      socketRef.current.emit("hand-raise", { raised: newHandRaised });
    }
    
    // Update current user in participants
    setParticipants(prev => prev.map(p => 
      p.isYou ? { ...p, handRaised: newHandRaised } : p
    ));
    
    return newHandRaised;
  }, [handRaised]);

  // Send chat message
  const sendMessage = useCallback((message) => {
    if (socketRef.current) {
      const messageData = {
        id: Date.now().toString(),
        sender: userName,
        senderId: currentUserIdRef.current,
        text: message,
        timestamp: new Date().toISOString()
      };
      socketRef.current.emit("chat-message", messageData);
      setMessages(prev => [...prev, messageData]);
    }
  }, [userName]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    peerConnectionsRef.current.forEach(pc => pc.close());
  }, []);

  return {
    isConnected,
    participants,
    messages,
    isMuted,
    isVideoOff,
    isScreenSharing,
    handRaised,
    initializeLocalMedia,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    toggleHandRaise,
    sendMessage,
    cleanup,
    setLocalVideoRef,
    localStream: localStreamRef.current
  };
};
