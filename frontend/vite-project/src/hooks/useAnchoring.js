import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export const useAnchoring = (roomId, userId, userName, isCreator, initialLanguage = 'en') => {
  const socketRef = useRef(null);
  const [isAnchoringEnabled, setIsAnchoringEnabled] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [schedule, setSchedule] = useState([]);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [announcement, setAnnouncement] = useState(null);
  const [isMutedByAnchor, setIsMutedByAnchor] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [anchorTtsAudio, setAnchorTtsAudio] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Get server URL from environment variable or use localhost
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.hostname || 'localhost';
  const ANCHORING_PORT = import.meta.env.VITE_ANCHORING_PORT || '3002';

  useEffect(() => {
    if (!roomId) return;

    // Connect to anchoring service
    socketRef.current = io(`http://${SERVER_URL}:${ANCHORING_PORT}`);

    socketRef.current.on('connect', () => {
      console.log('Connected to anchoring service');
      socketRef.current.emit('join-anchoring-room', { roomId, userId, language });
      
      // Get current anchoring status
      socketRef.current.emit('get-anchoring-status', { roomId }, (status) => {
        if (status.isActive) {
          setIsAnchoringEnabled(true);
          setIsActive(true);
          setSchedule(status.schedule || []);
          setCurrentSpeaker(status.currentSpeaker);
          setCurrentIndex(status.currentIndex);
          setTimeRemaining(status.timeRemaining);
        }
      });
    });

    // Listen for personalized TTS
    socketRef.current.on('anchor-tts', ({ script, audio, language }) => {
      console.log('Received anchor TTS:', { script, language, hasAudio: !!audio });
      setAnchorTtsAudio(audio);
      // Set speaking state
      setIsSpeaking(true);
      // Play the audio as base64 from Sarvam AI
      if (audio) {
        try {
          const audioEl = new Audio(`data:audio/mpeg;base64,${audio}`);
          audioEl.volume = 0.8;
          audioEl.onended = () => setIsSpeaking(false);
          audioEl.play().catch(err => {
            console.error("Anchor audio play error:", err);
            setIsSpeaking(false);
          });
        } catch (e) {
          console.error("Anchor audio error:", e);
          setIsSpeaking(false);
        }
      } else {
        setIsSpeaking(false);
      }
    });

    // Listen for anchoring events
    socketRef.current.on('anchoring-enabled', ({ schedule: newSchedule }) => {
      setIsAnchoringEnabled(true);
      setSchedule(newSchedule || []);
    });

    socketRef.current.on('anchoring-started', ({ schedule: newSchedule, currentIndex: index }) => {
      setIsActive(true);
      setSchedule(newSchedule || []);
      setCurrentIndex(index);
    });

    socketRef.current.on('anchoring-ended', () => {
      setIsActive(false);
      setCurrentSpeaker(null);
      setCurrentIndex(-1);
      setTimeRemaining(0);
      setIsMutedByAnchor(false);
    });

    socketRef.current.on('speaker-changed', ({ currentSpeaker: speaker, currentIndex: index, timeRemaining: time, timestamp }) => {
      console.log('🎤 Speaker changed:', { speaker, index, timeRemaining: time, timestamp });
      setCurrentSpeaker(speaker);
      setCurrentIndex(index);
      setTimeRemaining(time);
      setIsMutedByAnchor(false);
    });

    socketRef.current.on('time-update', ({ timeRemaining: time, timestamp }) => {
      console.log('⏰ Time update:', { timeRemaining: time, timestamp });
      setTimeRemaining(time);
    });

    socketRef.current.on('anchor-announcement', ({ script, audioUrl, speakerName, timestamp }) => {
      setAnnouncement({
        script,
        audioUrl,
        speakerName,
        timestamp
      });
      
      // Auto-clear announcement after 10 seconds
      setTimeout(() => {
        setAnnouncement(null);
      }, 10000);
    });

    socketRef.current.on('anchoring-control', ({ action, speakerId, speakerName: name, message }) => {
      if (action === 'mute-speaker') {
        if (speakerId === userId) {
          setIsMutedByAnchor(true);
        }
      } else if (action === 'unmute-speaker') {
        if (speakerId === userId) {
          setIsMutedByAnchor(false);
        }
      }
    });

    socketRef.current.on('anchoring-paused', () => {
      setIsActive(false);
    });

    socketRef.current.on('anchoring-resumed', () => {
      setIsActive(true);
    });

    socketRef.current.on('anchoring-reset', ({ timestamp }) => {
      console.log('🔄 Anchoring reset:', { timestamp });
      setIsActive(false);
      setCurrentSpeaker(null);
      setCurrentIndex(0);
      setTimeRemaining(0);
      setIsMutedByAnchor(false);
    });

    socketRef.current.on('anchoring-restarted', ({ timestamp }) => {
      console.log('🔄 Anchoring restarted:', { timestamp });
      setIsActive(true);
      setCurrentIndex(0);
      setIsMutedByAnchor(false);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId, userId]);

  // Creator actions
  const enableAnchoring = useCallback((settings) => {
    if (socketRef.current && isCreator) {
      socketRef.current.emit('enable-anchoring', {
        roomId,
        creatorId: userId,
        settings: {
          ...settings,
          language: settings.language || 'en-US'
        }
      });
      setIsAnchoringEnabled(true);
      setSchedule(settings.schedule || []);
    }
  }, [roomId, userId, isCreator]);

  const startAnchoring = useCallback(() => {
    console.log('Start anchoring clicked', { socketConnected: !!socketRef.current, isCreator, roomId });
    if (socketRef.current && isCreator) {
      socketRef.current.emit('start-anchoring', { roomId });
      console.log('Emitted start-anchoring event');
    } else {
      console.error('Cannot start anchoring:', { socketConnected: !!socketRef.current, isCreator });
    }
  }, [roomId, isCreator]);

  const pauseAnchoring = useCallback(() => {
    if (socketRef.current && isCreator) {
      socketRef.current.emit('pause-anchoring', { roomId });
    }
  }, [roomId, isCreator]);

  const resumeAnchoring = useCallback(() => {
    if (socketRef.current && isCreator) {
      socketRef.current.emit('resume-anchoring', { roomId });
    }
  }, [roomId, isCreator]);

  const skipSpeaker = useCallback(() => {
    if (socketRef.current && isCreator) {
      socketRef.current.emit('skip-speaker', { roomId });
    }
  }, [roomId, isCreator]);

  const stopAnchoring = useCallback(() => {
    if (socketRef.current && isCreator) {
      socketRef.current.emit('stop-anchoring', { roomId });
    }
  }, [roomId, isCreator]);

  const resetAnchoring = useCallback(() => {
    if (socketRef.current && isCreator) {
      socketRef.current.emit('reset-anchoring', { roomId });
      setIsActive(false);
    }
  }, [roomId, isCreator]);

  const restartAnchoring = useCallback(() => {
    if (socketRef.current && isCreator) {
      socketRef.current.emit('restart-anchoring', { roomId });
    }
  }, [roomId, isCreator]);

  const updateSchedule = useCallback((newSchedule) => {
    if (socketRef.current && isCreator) {
      socketRef.current.emit('update-schedule', { roomId, schedule: newSchedule });
      setSchedule(newSchedule);
    }
  }, [roomId, isCreator]);

  const updateAnchorLanguage = useCallback((newLanguage) => {
    if (socketRef.current) {
      socketRef.current.emit('update-anchor-language', { roomId, userId, language: newLanguage });
    }
  }, [roomId, userId]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    // State
    isAnchoringEnabled,
    isActive,
    schedule,
    currentSpeaker,
    currentIndex,
    timeRemaining,
    announcement,
    isMutedByAnchor,
    showScheduleModal,
    anchorTtsAudio,
    isSpeaking,
    
    // Setters
    setShowScheduleModal,
    
    // Actions
    enableAnchoring,
    startAnchoring,
    pauseAnchoring,
    resumeAnchoring,
    skipSpeaker,
    stopAnchoring,
    resetAnchoring,
    restartAnchoring,
    updateSchedule,
    updateAnchorLanguage,
    
    // Helpers
    formatTime
  };
};
