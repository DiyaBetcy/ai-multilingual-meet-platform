import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  ANCHORING_URL,
  SERVICE_CONFIG_ERRORS,
} from '../lib/serviceUrls.js';

const SILENT_AUDIO_DATA_URL =
  'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';

const browserLanguageByCode = {
  en: 'en-US',
  ml: 'ml-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  mr: 'mr-IN',
  od: 'or-IN',
  or: 'or-IN',
  pa: 'pa-IN',
  as: 'as-IN',
  ur: 'ur-PK',
};

const normalizeSpeechLanguage = (language) => {
  const raw = String(language || 'en').trim();
  if (raw.includes('-')) return raw;
  return browserLanguageByCode[raw.toLowerCase()] || 'en-US';
};

const pickBrowserVoice = (synth, language) => {
  const voices =
    typeof synth.getVoices === 'function' ? synth.getVoices() : [];
  const normalized = language.toLowerCase();
  const code = normalized.split('-')[0];

  return (
    voices.find((voice) => String(voice.lang).toLowerCase() === normalized) ||
    voices.find((voice) =>
      String(voice.lang).toLowerCase().startsWith(`${code}-`)
    ) ||
    voices.find((voice) => String(voice.lang).toLowerCase() === code) ||
    null
  );
};

/* Sarvam's non-streaming TTS endpoint returns WAV base64. Older code
   labelled every payload audio/mpeg, which could prevent playback. We
   still sniff common formats so future providers keep working. */
const audioDataUrlFor = (audio) => {
  if (!audio) return null;

  const value = String(audio).trim();

  if (!value) return null;
  if (value.startsWith('data:audio')) return value;
  if (value.startsWith('UklGR')) return `data:audio/wav;base64,${value}`;
  if (value.startsWith('SUQz') || value.startsWith('//u') || value.startsWith('//v')) {
    return `data:audio/mpeg;base64,${value}`;
  }
  if (value.startsWith('T2dnUw')) return `data:audio/ogg;base64,${value}`;
  if (value.startsWith('ZkxhQw')) return `data:audio/flac;base64,${value}`;

  return `data:audio/wav;base64,${value}`;
};

export const useAnchoring = (roomId, userId, userName, isCreator, initialLanguage = 'en') => {
  const socketRef = useRef(null);
  const timeUpdateTimeoutRef = useRef(null);
  const announcementTimeoutRef = useRef(null);
  const languageRef = useRef(initialLanguage || 'en');

  const audioElementRef = useRef(null);
  const audioQueueRef = useRef([]);
  const audioPlayingRef = useRef(false);
  const playedMessageIdsRef = useRef(new Set());
  const blockedAudioRef = useRef(null);
  const playbackTokenRef = useRef(0);
  const audioUnlockedRef = useRef(false);
  const playNextAnchorRef = useRef(null);
  const currentUtteranceRef = useRef(null);
  const speechWatchdogRef = useRef(null);

  const [isAnchoringEnabled, setIsAnchoringEnabled] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [schedule, setSchedule] = useState([]);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [announcement, setAnnouncement] = useState(null);
  const [isMutedByAnchor, setIsMutedByAnchor] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [anchorAudioStatus, setAnchorAudioStatus] = useState('idle');
  const [anchorAudioError, setAnchorAudioError] = useState('');
  const [connectionError, setConnectionError] = useState(
    ANCHORING_URL ? '' : SERVICE_CONFIG_ERRORS.anchoring
  );
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    languageRef.current = initialLanguage || 'en';
  }, [initialLanguage]);

  const speakWithBrowser = useCallback((text, language) => {
    return new Promise((resolve) => {
      const cleanText = String(text || '').trim();
      const synth =
        typeof window !== 'undefined' ? window.speechSynthesis : null;
      const Utterance =
        typeof window !== 'undefined'
          ? window.SpeechSynthesisUtterance
          : null;

      if (!cleanText) {
        resolve({ ok: false, error: 'The AI anchor had no text to speak.' });
        return;
      }

      if (!synth || !Utterance) {
        resolve({
          ok: false,
          error:
            'No speech provider is available. Set SARVAM_API_KEY on the backend or use a browser with speech synthesis.',
        });
        return;
      }

      try {
        synth.cancel();
        if (synth.paused) synth.resume();
      } catch (error) {
        console.warn('Could not reset browser speech synthesis:', error);
      }

      const utterance = new Utterance(cleanText);
      const speechLanguage = normalizeSpeechLanguage(language);

      utterance.lang = speechLanguage;
      utterance.rate = 0.98;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voice = pickBrowserVoice(synth, speechLanguage);
      if (voice) utterance.voice = voice;

      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;

        if (speechWatchdogRef.current) {
          clearTimeout(speechWatchdogRef.current);
          speechWatchdogRef.current = null;
        }

        if (currentUtteranceRef.current === utterance) {
          currentUtteranceRef.current = null;
        }

        resolve(result);
      };

      utterance.onend = () => finish({ ok: true });
      utterance.onerror = (event) => {
        const reason = event?.error || 'unknown';

        finish({
          ok: false,
          error:
            reason === 'not-allowed'
              ? 'The browser blocked anchor speech. Click “Enable anchor audio” to allow it.'
              : `Browser speech synthesis failed (${reason}).`,
        });
      };

      currentUtteranceRef.current = utterance;

      /* Some browsers do not fire onend for background tabs. Keep the
         queue from getting permanently stuck, but allow enough time for
         the whole script to be spoken. */
      speechWatchdogRef.current = setTimeout(
        () => finish({ ok: true }),
        Math.max(10000, Math.min(90000, cleanText.length * 220 + 8000))
      );

      try {
        synth.speak(utterance);
      } catch (error) {
        finish({
          ok: false,
          error: `Browser speech synthesis could not start: ${error.message}`,
        });
      }
    });
  }, []);

  const playNextAnchor = useCallback(() => {
    if (audioPlayingRef.current) return;

    const next = audioQueueRef.current.shift();

    if (!next) {
      setIsSpeaking(false);
      setAnchorAudioStatus((status) => (status === 'error' ? 'error' : 'idle'));
      return;
    }

    const token = playbackTokenRef.current + 1;
    playbackTokenRef.current = token;
    audioPlayingRef.current = true;
    setIsSpeaking(true);
    setAnchorAudioStatus('speaking');
    setAnchorAudioError('');

    let settled = false;
    let fallbackStarted = false;

    const finish = () => {
      if (settled || token !== playbackTokenRef.current) return;
      settled = true;
      audioPlayingRef.current = false;
      setIsSpeaking(false);
      setAnchorAudioStatus('idle');
      playNextAnchorRef.current?.();
    };

    const fallbackToBrowser = (reason) => {
      if (settled || fallbackStarted || token !== playbackTokenRef.current) {
        return;
      }

      fallbackStarted = true;
      console.warn('Anchor audio unavailable, using browser speech synthesis:', reason);

      if (audioElementRef.current) {
        audioElementRef.current.onended = null;
        audioElementRef.current.onerror = null;
        audioElementRef.current.pause();
      }

      speakWithBrowser(next.script, next.language)
        .then((result) => {
          if (settled || token !== playbackTokenRef.current) return;

          if (result.ok) {
            finish();
            return;
          }

          settled = true;
          audioPlayingRef.current = false;
          blockedAudioRef.current = next;
          setIsSpeaking(false);
          setAnchorAudioStatus('error');
          setAnchorAudioError(result.error || 'Anchor audio could not be played.');
        })
        .catch((error) => {
          if (settled || token !== playbackTokenRef.current) return;

          settled = true;
          audioPlayingRef.current = false;
          blockedAudioRef.current = next;
          setIsSpeaking(false);
          setAnchorAudioStatus('error');
          setAnchorAudioError(
            error?.message || 'Anchor audio could not be played.'
          );
        });
    };

    if (!next.audio) {
      fallbackToBrowser('the server returned no audio');
      return;
    }

    try {
      const audio = audioElementRef.current || new Audio();
      audioElementRef.current = audio;
      audio.pause();
      audio.muted = false;
      audio.volume = 0.95;
      audio.src = audioDataUrlFor(next.audio);
      audio.onended = finish;
      audio.onerror = () => fallbackToBrowser('the audio element rejected the file');

      const playPromise = audio.play();

      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
          fallbackToBrowser(error?.message || 'autoplay was blocked');
        });
      }
    } catch (error) {
      fallbackToBrowser(error?.message || 'audio setup failed');
    }
  }, [speakWithBrowser]);

  playNextAnchorRef.current = playNextAnchor;

  const enqueueAnchorMessage = useCallback(
    ({ script, audio, language, messageId, timestamp } = {}) => {
      const cleanScript = String(script || '').trim();

      if (!cleanScript) {
        console.warn('Ignoring an empty AI anchor script.');
        return;
      }

      const key =
        messageId ||
        `${timestamp || ''}|${language || ''}|${cleanScript}`;

      if (playedMessageIdsRef.current.has(key)) {
        console.log('Skipping duplicate anchor audio message:', key);
        return;
      }

      playedMessageIdsRef.current.add(key);

      if (playedMessageIdsRef.current.size > 200) {
        const oldest = playedMessageIdsRef.current.values().next().value;
        playedMessageIdsRef.current.delete(oldest);
      }

      audioQueueRef.current.push({
        id: key,
        script: cleanScript,
        audio: audio || null,
        language: language || languageRef.current,
      });

      playNextAnchorRef.current?.();
    },
    []
  );

  const stopAnchorPlayback = useCallback(() => {
    playbackTokenRef.current += 1;
    audioQueueRef.current = [];
    blockedAudioRef.current = null;
    audioPlayingRef.current = false;

    setIsSpeaking(false);
    setAnchorAudioStatus('idle');
    setAnchorAudioError('');

    if (audioElementRef.current) {
      audioElementRef.current.onended = null;
      audioElementRef.current.onerror = null;
      audioElementRef.current.pause();
    }

    if (speechWatchdogRef.current) {
      clearTimeout(speechWatchdogRef.current);
      speechWatchdogRef.current = null;
    }

    currentUtteranceRef.current = null;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (error) {
        console.warn('Could not cancel browser speech synthesis:', error);
      }
    }
  }, []);

  const retryAnchorAudio = useCallback(() => {
    const blocked = blockedAudioRef.current;
    blockedAudioRef.current = null;
    setAnchorAudioError('');

    if (blocked) {
      audioQueueRef.current.unshift(blocked);
    }

    if (!audioPlayingRef.current) {
      setAnchorAudioStatus('idle');
      playNextAnchorRef.current?.();
    }
  }, []);

  /* Prime the reusable audio element on the first real user gesture.
     This makes later programmatic anchor playback much more reliable
     without ever playing an audible test sound. */
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const unlockAndRetry = () => {
      if (
        !audioUnlockedRef.current &&
        !audioPlayingRef.current &&
        !blockedAudioRef.current &&
        audioQueueRef.current.length === 0
      ) {
        try {
          const audio = audioElementRef.current || new Audio();
          audioElementRef.current = audio;
          audio.muted = true;
          audio.src = SILENT_AUDIO_DATA_URL;

          const playPromise = audio.play();

          if (playPromise && typeof playPromise.then === 'function') {
            playPromise
              .then(() => {
                audio.pause();
                audio.muted = false;
                audio.removeAttribute('src');
                audioUnlockedRef.current = true;
              })
              .catch(() => {
                audio.muted = false;
              });
          }
        } catch (error) {
          console.warn('Could not unlock anchor audio:', error);
        }
      }

      if (blockedAudioRef.current) {
        retryAnchorAudio();
      }
    };

    document.addEventListener('pointerdown', unlockAndRetry);
    document.addEventListener('keydown', unlockAndRetry);

    return () => {
      document.removeEventListener('pointerdown', unlockAndRetry);
      document.removeEventListener('keydown', unlockAndRetry);
    };
  }, [retryAnchorAudio]);

  useEffect(() => {
    if (!roomId || !userId) return undefined;

    /* A production build without VITE_ANCHORING_URL must never fall back
       to localhost: it would point every visitor at their own machine.
       Skipping the socket keeps the meeting usable and logs one clear
       message instead of an endless ERR_CONNECTION_REFUSED loop. */
    if (!ANCHORING_URL) {
      console.error(SERVICE_CONFIG_ERRORS.anchoring);
      setConnectionError(SERVICE_CONFIG_ERRORS.anchoring);
      return undefined;
    }

    socketRef.current = io(ANCHORING_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to anchoring backend:', socketRef.current.id);
      setConnectionError('');

      socketRef.current.emit('join-anchoring-room', {
        roomId,
        userId,
        userName,
        language: languageRef.current,
      });

      console.log('🎤 Joined anchoring room:', {
        roomId,
        userId,
        userName,
        language: languageRef.current,
      });

      socketRef.current.emit('get-anchoring-status', { roomId }, (status) => {
        console.log('📊 Anchoring status received:', status);

        if (status) {
          setIsAnchoringEnabled(Boolean(status.isAnchoringEnabled));
          setIsActive(Boolean(status.isActive));
          setSchedule(status.schedule || []);
          setCurrentSpeaker(status.currentSpeaker || null);
          setCurrentIndex(status.currentIndex ?? 0);
          setTimeRemaining(status.timeRemaining ?? 0);
          setHasStarted(
            Boolean(status.isActive) ||
              Boolean(status.currentSpeaker) ||
              (status.currentIndex ?? 0) > 0
          );
        }
      });
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('❌ Anchoring socket connection error:', err.message);
      setConnectionError(
        `Cannot reach the anchoring server at ${ANCHORING_URL}. ${
          err?.message || 'connection failed'
        }`
      );
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Disconnected from anchoring backend');
      setConnectionError('');
    });

    socketRef.current.on('anchor-tts', (payload = {}) => {
      const { script, audio, language, messageId, timestamp } = payload;

      console.log('🔊 Received anchor TTS:', {
        script,
        language,
        hasAudio: Boolean(audio),
        messageId,
      });

      enqueueAnchorMessage({ script, audio, language, messageId, timestamp });
    });

    socketRef.current.on('anchoring-enabled', ({ schedule: newSchedule } = {}) => {
      console.log('✅ Anchoring enabled:', newSchedule);
      setIsAnchoringEnabled(true);
      setSchedule(newSchedule || []);
      setHasStarted(false);
    });

    socketRef.current.on('anchoring-schedule-updated', ({ schedule: newSchedule } = {}) => {
      console.log('📋 Anchoring schedule updated:', newSchedule);
      setSchedule(Array.isArray(newSchedule) ? newSchedule : []);
    });

    socketRef.current.on('anchoring-started', ({ schedule: newSchedule, currentIndex: index } = {}) => {
      console.log('▶️ Anchoring started');
      setIsActive(true);
      setHasStarted(true);
      setSchedule(newSchedule || []);
      setCurrentIndex(index ?? 0);
    });

    socketRef.current.on('anchoring-ended', () => {
      console.log('⏹️ Anchoring ended');
      setIsActive(false);
      setCurrentSpeaker(null);
      setCurrentIndex(0);
      setTimeRemaining(0);
      setIsMutedByAnchor(false);
      setHasStarted(false);
    });

    socketRef.current.on('speaker-changed', ({ currentSpeaker: speaker, currentIndex: index, timeRemaining: time, timestamp } = {}) => {
      console.log('🎤 Speaker changed:', { speaker, index, timeRemaining: time, timestamp });
      setCurrentSpeaker(speaker);
      setCurrentIndex(index ?? 0);
      setTimeRemaining(time ?? 0);
      setIsMutedByAnchor(false);
      setHasStarted(true);
    });

    socketRef.current.on('time-update', ({ timeRemaining: time, timestamp } = {}) => {
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

    socketRef.current.on('anchor-announcement', ({ script, audioUrl, speakerName, timestamp, messageId } = {}) => {
      console.log('📢 Anchor announcement:', script);

      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }

      setAnnouncement({
        script,
        audioUrl,
        speakerName: speakerName || 'AI Anchor',
        timestamp,
        messageId,
      });

      announcementTimeoutRef.current = setTimeout(() => {
        setAnnouncement(null);
      }, 10000);
    });

    socketRef.current.on('anchoring-control', ({ action, speakerId } = {}) => {
      console.log('🎛️ Anchoring control:', { action, speakerId });

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

    socketRef.current.on('anchoring-reset', ({ timestamp } = {}) => {
      console.log('🔄 Anchoring reset:', { timestamp });
      stopAnchorPlayback();
      setIsActive(false);
      setCurrentSpeaker(null);
      setCurrentIndex(0);
      setTimeRemaining(0);
      setIsMutedByAnchor(false);
      setHasStarted(false);
    });

    socketRef.current.on('anchoring-restarted', ({ timestamp } = {}) => {
      console.log('🔁 Anchoring restarted:', { timestamp });
      setIsActive(true);
      setCurrentIndex(0);
      setIsMutedByAnchor(false);
      setHasStarted(true);
    });

    socketRef.current.on('anchoring-error', ({ message } = {}) => {
      console.error('❌ Anchoring error:', message);
      setAnchorAudioStatus('error');
      setAnchorAudioError(message || 'The AI anchor reported an error.');
    });

    return () => {
      playbackTokenRef.current += 1;
      audioQueueRef.current = [];
      blockedAudioRef.current = null;
      audioPlayingRef.current = false;

      if (timeUpdateTimeoutRef.current) {
        clearTimeout(timeUpdateTimeoutRef.current);
        timeUpdateTimeoutRef.current = null;
      }

      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
        announcementTimeoutRef.current = null;
      }

      if (speechWatchdogRef.current) {
        clearTimeout(speechWatchdogRef.current);
        speechWatchdogRef.current = null;
      }

      currentUtteranceRef.current = null;

      if (audioElementRef.current) {
        audioElementRef.current.onended = null;
        audioElementRef.current.onerror = null;
        audioElementRef.current.pause();
      }

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch (error) {
          console.warn('Could not cancel browser speech synthesis:', error);
        }
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [
    roomId,
    userId,
    userName,
    enqueueAnchorMessage,
    stopAnchorPlayback,
  ]);

  const enableAnchoring = useCallback((settings) => {
    console.log('🎤 Enable anchoring clicked:', { isCreator, roomId, settings });

    if (socketRef.current && isCreator) {
      socketRef.current.emit('enable-anchoring', {
        roomId,
        creatorId: userId,
        settings: {
          ...settings,
          language: settings.language || languageRef.current,
        },
      });

      setIsAnchoringEnabled(true);
      setSchedule(settings.schedule || []);
    } else {
      console.error('❌ Cannot enable anchoring:', {
        socketConnected: Boolean(socketRef.current?.connected),
        isCreator,
      });
      setConnectionError(
        socketRef.current
          ? 'The AI anchoring server is not connected. Check VITE_ANCHORING_URL and the Render service, then try again.'
          : SERVICE_CONFIG_ERRORS.anchoring
      );
    }
  }, [roomId, userId, isCreator]);

  const startAnchoring = useCallback(() => {
    console.log('▶️ Start anchoring clicked:', {
      socketConnected: Boolean(socketRef.current),
      socketId: socketRef.current?.id,
      isCreator,
      roomId,
    });

    if (socketRef.current && isCreator) {
      setAnchorAudioError('');
      socketRef.current.emit('start-anchoring', { roomId });
      console.log('✅ Emitted start-anchoring event');
    } else {
      console.error('❌ Cannot start anchoring:', {
        socketConnected: Boolean(socketRef.current?.connected),
        isCreator,
      });
      setConnectionError(
        socketRef.current
          ? 'The AI anchoring server is not connected. Check VITE_ANCHORING_URL and the Render service, then try again.'
          : SERVICE_CONFIG_ERRORS.anchoring
      );
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
      stopAnchorPlayback();
      socketRef.current.emit('skip-speaker', { roomId });
    }
  }, [roomId, isCreator, stopAnchorPlayback]);

  const stopAnchoring = useCallback(() => {
    if (socketRef.current && isCreator) {
      stopAnchorPlayback();
      socketRef.current.emit('stop-anchoring', { roomId });
    }
  }, [roomId, isCreator, stopAnchorPlayback]);

  const resetAnchoring = useCallback(() => {
    if (socketRef.current && isCreator) {
      stopAnchorPlayback();
      socketRef.current.emit('reset-anchoring', { roomId });
      setIsActive(false);
    }
  }, [roomId, isCreator, stopAnchorPlayback]);

  const restartAnchoring = useCallback(() => {
    if (socketRef.current && isCreator) {
      stopAnchorPlayback();
      socketRef.current.emit('restart-anchoring', { roomId });
    }
  }, [roomId, isCreator, stopAnchorPlayback]);

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
    isSpeaking,
    anchorAudioStatus,
    anchorAudioError,
    connectionError,
    canResume: isAnchoringEnabled && hasStarted && !isActive,

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
    retryAnchorAudio,

    formatTime,
  };
};
