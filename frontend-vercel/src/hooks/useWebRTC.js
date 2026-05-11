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
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const speakingIntervalRef = useRef(null);

  // Get server URL from environment variable or use localhost
  const WEBRTC_URL =
    import.meta.env.VITE_WEBRTC_URL ||
    `http://${import.meta.env.VITE_SERVER_URL || window.location.hostname || 'localhost'}:${import.meta.env.VITE_WEBRTC_PORT || '3001'}`;

  // ICE servers configuration
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ];

  // Setup audio level detection for a stream
  const setupAudioLevelDetection = useCallback((stream, userId) => {
    if (!stream || !userId) return;
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        // If audio level is above threshold, mark as speaking
        if (average > 20) {
          setSpeakingUser(userId);
        }
      };
      
      const intervalId = setInterval(checkAudioLevel, 100);
      
      return () => {
        clearInterval(intervalId);
        source.disconnect();
        audioContext.close();
      };
    } catch (error) {
      console.error('Audio level detection error:', error);
    }
  }, []);

  // Initialize socket connection
  useEffect(() => {
    if (!roomId || !userName) return;

    socketRef.current = io(WEBRTC_URL, {
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
    socketRef.current.on("user-joined", async (participant) => {
      if (participant.id !== currentUserIdRef.current) {
        await createPeerConnection(participant.id, true);
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
    socketRef.current.on("offer", async ({ fromId, offer }) => {
      const pc = await createPeerConnection(fromId, false);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit("answer", { targetId: fromId, answer });
    });

    socketRef.current.on("answer", async ({ fromId, answer }) => {
      const pc = peerConnectionsRef.current.get(fromId);
      if (pc) {
        await pc.setRemoteDescription(answer);
      }
    });

    socketRef.current.on("ice-candidate", async ({ fromId, candidate }) => {
      const pc = peerConnectionsRef.current.get(fromId);
      if (pc) {
        await pc.addIceCandidate(candidate);
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
    console.log('Creating peer connection for:', participantId, 'isInitiator:', isInitiator);
    const pc = new RTCPeerConnection({ iceServers });
    
    // Add local stream
    if (localStreamRef.current) {
      console.log('Adding local stream to peer connection:', localStreamRef.current.getTracks().length, 'tracks');
      localStreamRef.current.getTracks().forEach(track => {
        console.log('Adding track:', track.kind);
        pc.addTrack(track, localStreamRef.current);
      });
    } else {
      console.warn('No local stream available to add to peer connection');
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track for:', participantId, event.streams[0]);
      const remoteVideo = document.getElementById(`video-${participantId}`);
      if (remoteVideo) {
        console.log('Setting remote stream to video element');
        remoteVideo.srcObject = event.streams[0];
      } else {
        console.warn('Remote video element not found for:', participantId);
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
      console.log('Local media initialized:', stream.getTracks().length, 'tracks');
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Setup audio level detection for local user
      if (audio) {
        setupAudioLevelDetection(stream, currentUserIdRef.current);
      }

      // Add stream to existing peer connections
      peerConnectionsRef.current.forEach((pc, participantId) => {
        console.log('Adding stream to existing peer connection for:', participantId);
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
      });

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
        const newState = !audioTrack.enabled;
        setIsMuted(newState);
        
        // Notify others
        if (socketRef.current) {
          socketRef.current.emit("media-state-change", {
            micOn: !newState,
            camOn: !isVideoOff
          });
        }
        return !newState;
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
    localStream: localStreamRef.current
  };
};
