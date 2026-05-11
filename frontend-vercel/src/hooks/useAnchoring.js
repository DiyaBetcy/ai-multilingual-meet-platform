import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export const useAnchoring = (roomId, userId, userName, isCreator, initialLanguage = 'en') => {
  const socketRef = useRef(null);
  const timeUpdateTimeoutRef = useRef(null);

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

  const ANCHORING_URL =
    import.meta.env.VITE_ANCHORING_URL ||
    import.meta.env.VITE_TRANSLATION_SERVER_URL ||
    'http://localhost:5000';

  useEffect(() => {
    if (!roomId || !userId) return;

    // Disable anchoring connection - backend is translation-only
    // Keep UI components but don't connect to socket
    console.log('⚠️ Anchoring disabled - backend is translation-only');
    return;

    socketRef.current = io(ANCHORING_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to anchoring backend:', socketRef.current.id);

      socketRef.current.emit('join-anchoring-room', {
        roomId,
        userId,
        userName,
        language: initialLanguage || 'en',
      });

      console.log('🎤 Joined anchoring room:', {
        roomId,
        userId,
        userName,
        language: initialLanguage || 'en',
      });

      socketRef.current.emit('get-anchoring-status', { roomId }, (status) => {
        console.log('📊 Anchoring status received:', status);

        if (status?.isAnchoringEnabled || status?.schedule) {
          setIsAnchoringEnabled(status.isAnchoringEnabled || true);
          setIsActive(status.isActive || false);
          setSchedule(status.schedule || []);
          setCurrentSpeaker(status.currentSpeaker || null);
          setCurrentIndex(status.currentIndex || 0);
          setTimeRemaining(status.timeRemaining || 0);
        }
      });
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('❌ Anchoring socket connection error:', err.message);
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Disconnected from anchoring backend');
    });

    socketRef.current.on('anchor-tts', ({ script, audio, language }) => {
      console.log('🔊 Received anchor TTS:', {
        script,
        language,
        hasAudio: !!audio,
      });

      setAnchorTtsAudio(audio);
      setIsSpeaking(true);

      if (!audio) {
        setIsSpeaking(false);
        return;
      }

      try {
        const audioEl = new Audio(`data:audio/mpeg;base64,${audio}`);
        audioEl.volume = 0.9;

        audioEl.onended = () => {
          setIsSpeaking(false);
        };

        audioEl.onerror = (err) => {
          console.error('❌ Anchor audio element error:', err);
          setIsSpeaking(false);
        };

        audioEl.play().catch((err) => {
          console.error('❌ Anchor audio play blocked/failed:', err);
          setIsSpeaking(false);
        });
      } catch (err) {
        console.error('❌ Anchor audio setup error:', err);
        setIsSpeaking(false);
      }
    });

    socketRef.current.on('anchoring-enabled', ({ schedule: newSchedule }) => {
      console.log('✅ Anchoring enabled:', newSchedule);
      setIsAnchoringEnabled(true);
      setSchedule(newSchedule || []);
    });

    socketRef.current.on('anchoring-started', ({ schedule: newSchedule, currentIndex: index }) => {
      console.log('▶️ Anchoring started');
      setIsActive(true);
      setSchedule(newSchedule || []);
      setCurrentIndex(index || 0);
    });

    socketRef.current.on('anchoring-ended', () => {
      console.log('⏹️ Anchoring ended');
      setIsActive(false);
      setCurrentSpeaker(null);
      setCurrentIndex(-1);
      setTimeRemaining(0);
      setIsMutedByAnchor(false);
    });

    socketRef.current.on('speaker-changed', ({ currentSpeaker: speaker, currentIndex: index, timeRemaining: time, timestamp }) => {
      console.log('🎤 Speaker changed:', { speaker, index, timeRemaining: time, timestamp });
      setCurrentSpeaker(speaker);
      setCurrentIndex(index || 0);
      setTimeRemaining(time || 0);
      setIsMutedByAnchor(false);
    });

    socketRef.current.on('time-update', ({ timeRemaining: time, timestamp }) => {
      if (timeUpdateTimeoutRef.current) {
        clearTimeout(timeUpdateTimeoutRef.current);
      }

      timeUpdateTimeoutRef.current = setTimeout(() => {
        setTimeRemaining((prevTime) => {
          if (prevTime !== time) return time;
          return prevTime;
        });
      }, 100);

      console.log('⏰ Time update:', { timeRemaining: time, timestamp });
    });

    socketRef.current.on('anchor-announcement', ({ script, audioUrl, speakerName, timestamp }) => {
      console.log('📢 Anchor announcement:', script);

      setAnnouncement({
        script,
        audioUrl,
        speakerName: speakerName || 'AI Anchor',
        timestamp,
      });

      setTimeout(() => {
        setAnnouncement(null);
      }, 10000);
    });

    socketRef.current.on('anchoring-control', ({ action, speakerId, speakerName: name, message }) => {
      console.log('🎛️ Anchoring control:', { action, speakerId, name, message });

      if (action === 'mute-speaker' && speakerId === userId) {
        setIsMutedByAnchor(true);
      }

      if (action === 'unmute-speaker' && speakerId === userId) {
        setIsMutedByAnchor(false);
      }
    });

    socketRef.current.on('anchoring-paused', () => {
      console.log('⏸️ Anchoring paused');
      setIsActive(false);
    });

    socketRef.current.on('anchoring-resumed', () => {
      console.log('▶️ Anchoring resumed');
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
      console.log('🔁 Anchoring restarted:', { timestamp });
      setIsActive(true);
      setCurrentIndex(0);
      setIsMutedByAnchor(false);
    });

    socketRef.current.on('anchoring-error', ({ message }) => {
      console.error('❌ Anchoring error:', message);
    });

    return () => {
      if (timeUpdateTimeoutRef.current) {
        clearTimeout(timeUpdateTimeoutRef.current);
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [roomId, userId, userName, initialLanguage, ANCHORING_URL]);

  const enableAnchoring = useCallback((settings) => {
    console.log('🎤 Enable anchoring clicked:', { isCreator, roomId, settings });

    if (socketRef.current && isCreator) {
      socketRef.current.emit('enable-anchoring', {
        roomId,
        creatorId: userId,
        settings: {
          ...settings,
          language: settings.language || initialLanguage || 'en',
        },
      });

      setIsAnchoringEnabled(true);
      setSchedule(settings.schedule || []);
    } else {
      console.error('❌ Cannot enable anchoring:', {
        socketConnected: !!socketRef.current,
        isCreator,
      });
    }
  }, [roomId, userId, isCreator, initialLanguage]);

  const startAnchoring = useCallback(() => {
    console.log('▶️ Start anchoring clicked:', {
      socketConnected: !!socketRef.current,
      socketId: socketRef.current?.id,
      isCreator,
      roomId,
    });

    if (socketRef.current && isCreator) {
      socketRef.current.emit('start-anchoring', { roomId });
      console.log('✅ Emitted start-anchoring event');
    } else {
      console.error('❌ Cannot start anchoring:', {
        socketConnected: !!socketRef.current,
        isCreator,
      });
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
      socketRef.current.emit('update-anchor-language', {
        roomId,
        userId,
        language: newLanguage,
      });
    }
  }, [roomId, userId]);

  const formatTime = useCallback((seconds) => {
    const safeSeconds = Number(seconds) || 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
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

    setShowScheduleModal,

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

    formatTime,
  };
};