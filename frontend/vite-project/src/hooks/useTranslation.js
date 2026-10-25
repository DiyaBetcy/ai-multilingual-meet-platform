import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import {
  TRANSLATION_URL,
  SERVICE_CONFIG_ERRORS,
} from "../lib/serviceUrls.js";

const languageNames = {
  en: "English",
  ml: "Malayalam",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  bn: "Bengali",
  gu: "Gujarati",
  mr: "Marathi",
  od: "Odia",
  pa: "Punjabi",
  as: "Assamese",
  ur: "Urdu",
};

/* SpeechRecognition uses BCP-47 locales, while the translation service
   uses short ISO codes. Keeping the two separate prevents every speaker
   from being transcribed as English. */
const speechRecognitionLanguages = {
  en: "en-US",
  ml: "ml-IN",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  mr: "mr-IN",
  od: "or-IN",
  pa: "pa-IN",
  as: "as-IN",
  ur: "ur-PK",
};

const normalizeLanguage = (language) =>
  String(language || "en").split("-")[0].toLowerCase();

const speechLanguageFor = (language) =>
  speechRecognitionLanguages[normalizeLanguage(language)] || "en-US";

export const useTranslation = (
  roomId,
  userName,
  userId,
  initialLanguage = "en"
) => {
  const socketRef = useRef(null);
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const audioQueueRef = useRef([]);
  const isPlayingAudioRef = useRef(false);
  const playedAudioMessageIdsRef = useRef(new Set());
  const lastFinalTextRef = useRef({ text: "", at: 0 });
  /* Two independent preferences:
     - languageRef / currentLanguage: the language this participant wants
       to READ and HEAR (the translation target).
     - speakingLanguageRef / speakingLanguage: the language this
       participant actually SPEAKS (the recognition/source language).
     They default to the same value but can be changed independently. */
  const languageRef = useRef(normalizeLanguage(initialLanguage));
  const speakingLanguageRef = useRef(normalizeLanguage(initialLanguage));
  const currentAudioRef = useRef(null);
  const captionClearTimeoutRef = useRef(null);
  const captionSequenceRef = useRef(0);
  const playNextAudioRef = useRef(null);
  const startListeningRef = useRef(null);
  const audioBlockedRef = useRef(false);
  const autoStartedListeningRef = useRef(false);
  const automaticStartRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(
    TRANSLATION_URL ? "" : SERVICE_CONFIG_ERRORS.translation
  );
  const [currentLanguage, setCurrentLanguage] = useState(() =>
    normalizeLanguage(initialLanguage)
  );
  const [speakingLanguage, setSpeakingLanguage] = useState(() =>
    normalizeLanguage(initialLanguage)
  );
  const [availableLanguages, setAvailableLanguages] = useState(languageNames);
  const [caption, setCaption] = useState({
    speaker: "",
    originalText: "",
    translatedText: "",
    translationError: "",
    isOriginal: false,
    targetLanguage: normalizeLanguage(initialLanguage),
  });
  const [isListening, setIsListening] = useState(false);
  /* Translation mode is a per-participant choice (on by default): while it
     is on, the participant receives the translated captions/audio and the
     original WebRTC audio of the other participants is muted. It is
     deliberately not tied to whether speech recognition is currently
     running, so a listener who never presses "Translate" still hears the
     meeting in their own language. */
  const [translationEnabled, setTranslationEnabledState] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [audioError, setAudioError] = useState("");

  const translationEnabledRef = useRef(true);

  const unlockAudio = useCallback(() => {
    if (audioUnlocked) return;
    try {
      if (typeof window !== "undefined") {
        const audio = new Audio();
        audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
        audio.volume = 0;
        audio.play().then(() => {
          audio.pause();
          audioBlockedRef.current = false;
          setAudioError("");
          setAudioUnlocked(true);
          console.log("[TRANSLATE] Audio unlocked");
          playNextAudioRef.current?.();
        }).catch(() => {});
      }
    } catch (e) {
      console.error("Audio unlock failed:", e);
    }
  }, [audioUnlocked]); 

  useEffect(() => {
    const handler = () => unlockAudio();
    if (typeof window !== "undefined") {
      window.addEventListener("click", handler, { once: true });
      window.addEventListener("touchstart", handler, { once: true });
      window.addEventListener("keydown", handler, { once: true });
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("click", handler);
        window.removeEventListener("touchstart", handler);
        window.removeEventListener("keydown", handler);
      }
    };
  }, [unlockAudio]);

  // Preload voices for browser TTS
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      const handleVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const getSpeechSynthesisVoice = useCallback((langCode) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;

    const voices = window.speechSynthesis.getVoices() || [];
    if (voices.length === 0) return null;

    const normalized = normalizeLanguage(langCode);
    // Try exact match first
    let voice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(normalized));
    // Try more specific matches
    if (!voice && normalized === "ml") {
      voice = voices.find((v) => v.lang && (v.lang.includes("ml-IN") || v.name.toLowerCase().includes("malayalam")));
    }
    if (!voice && normalized === "en") {
      voice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
    }
    // Fallback to any voice for the region
    if (!voice) {
      voice = voices.find((v) => v.lang && v.lang.includes(langCode.split('-')[0]));
    }
    // Last resort - just pick first available voice
    if (!voice && voices.length > 0) {
      console.warn(`No voice found for ${langCode}, using fallback: ${voices[0].name}`);
      voice = voices[0];
    }
    
    return voice;
  }, []);

  const speakWithBrowserTTS = useCallback((text, langCode) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      console.warn("SpeechSynthesis not available");
      return Promise.reject(new Error("SpeechSynthesis not available"));
    }

    if (!text || !text.trim()) {
      return Promise.reject(new Error("Empty text"));
    }

    return new Promise((resolve, reject) => {
      try {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = getSpeechSynthesisVoice(langCode);
        if (voice) {
          utterance.voice = voice;
          console.log(`Using voice: ${voice.name} for ${langCode}`);
        } else {
          console.warn(`No compatible voice found for ${langCode}`);
        }
        utterance.lang = langCode || speechLanguageFor(normalizeLanguage(langCode));
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onend = () => {
          isPlayingAudioRef.current = false;
          setAudioError("");
          playNextAudio();
          resolve();
        };

        utterance.onerror = (err) => {
          console.error("Browser TTS error:", err);
          setAudioError(
            "Translated speech could not be played. Check that your browser has a voice for the selected language."
          );
          isPlayingAudioRef.current = false;
          playNextAudio();
          reject(err);
        };

        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error("Browser TTS setup error:", error);
        setAudioError(
          "Translated speech could not be played. Check that your browser has a voice for the selected language."
        );
        isPlayingAudioRef.current = false;
        reject(error);
      }
    });
  }, [getSpeechSynthesisVoice]);

  const playNextAudio = useCallback(() => {
    if (isPlayingAudioRef.current || audioBlockedRef.current) return;

    const nextAudio = audioQueueRef.current.shift();
    if (!nextAudio) {
      setAudioError("");
      return;
    }

    try {
      isPlayingAudioRef.current = true;

      // Check if it's browser TTS request
      if (typeof nextAudio === 'object' && nextAudio.type === 'browser-tts') {
        speakWithBrowserTTS(nextAudio.text, nextAudio.language, nextAudio.messageId)
          .catch((err) => {
            console.error("Browser TTS failed:", err);
            isPlayingAudioRef.current = false;
            playNextAudio();
          });
        return;
      }

      let audioSrc = nextAudio;

      if (typeof nextAudio === 'string' && !nextAudio.startsWith("data:audio")) {
        audioSrc = `data:audio/wav;base64,${nextAudio}`;
      }

      const audio = new Audio(audioSrc);
      audio.volume = 1.0;
      currentAudioRef.current = audio;

      audio.onended = () => {
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        isPlayingAudioRef.current = false;
        playNextAudio();
      };

      audio.onerror = (err) => {
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        console.error("Translated audio playback error:", err);
        isPlayingAudioRef.current = false;
        playNextAudio();
      };

      const playAttempt = audio.play();

      if (playAttempt && typeof playAttempt.then === "function") {
        playAttempt
          .then(() => setAudioError(""))
          .catch((err) => {
            console.error("Audio play blocked/error:", err);
            if (currentAudioRef.current === audio) currentAudioRef.current = null;

            /* Keep the audio for the next user gesture instead of
               dropping it. Browsers block programmatic playback until
               the page has been interacted with. */
            audioQueueRef.current.unshift(nextAudio);
            audioBlockedRef.current = true;
            isPlayingAudioRef.current = false;
            setAudioError(
              "Translated audio is ready. Click anywhere in the page to play it."
            );
          });
      }
    } catch (error) {
      console.error("Audio playback setup error:", error);
      isPlayingAudioRef.current = false;
    }
  }, [speakWithBrowserTTS]);

  playNextAudioRef.current = playNextAudio;

  const resumeAudioPlayback = useCallback(() => {
    if (!audioBlockedRef.current && audioQueueRef.current.length === 0) {
      return;
    }

    audioBlockedRef.current = false;
    setAudioError("");
    playNextAudioRef.current?.();
  }, []);

  /* A user gesture can happen at any time (for example after a browser
     blocked the first translated clip). Keep listening instead of
     relying on the one-shot unlock listener. */
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handler = () => resumeAudioPlayback();

    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);

    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [resumeAudioPlayback]);

  const enqueueTranslatedAudio = useCallback(
    (base64Audio, mimeType = "audio/wav") => {
      if (!base64Audio) return;

      const audioSrc = String(base64Audio).startsWith("data:audio")
        ? String(base64Audio)
        : `data:${mimeType || "audio/wav"};base64,${base64Audio}`;

      console.log("Adding translated audio to queue, length:", base64Audio.length);

      audioQueueRef.current.push(audioSrc);
      playNextAudio();
    },
    [playNextAudio]
  );

  const enqueueBrowserTTS = useCallback(
    (text, language) => {
      if (!text || !text.trim()) return;
      console.log("Adding browser TTS to queue:", { text: text.substring(0, 50), language });
      audioQueueRef.current.push({ type: 'browser-tts', text, language });
      playNextAudio();
    },
    [playNextAudio]
  );

  /* The language selector changes the user's preferred (target) language;
     it must not recreate the socket or change the language they speak. */
  useEffect(() => {
    languageRef.current = normalizeLanguage(currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    speakingLanguageRef.current = normalizeLanguage(speakingLanguage);
  }, [speakingLanguage]);

  useEffect(() => {
    translationEnabledRef.current = translationEnabled;
    if (typeof window !== "undefined") {
      window.translationReceivingEnabled = translationEnabled;
    }
  }, [translationEnabled]);

  /* If the spoken language changes while the mic is active, restart
     recognition with the matching BCP-47 locale. The recipient language
     (currentLanguage) must never drive recognition. */
  useEffect(() => {
    const recognition = recognitionRef.current;
    const nextLocale = speechLanguageFor(speakingLanguage);

    if (
      recognition &&
      shouldListenRef.current &&
      recognition.lang !== nextLocale
    ) {
      recognition.lang = nextLocale;
      try {
        recognition.stop();
      } catch (error) {
        console.error("Could not restart recognition for language change:", error);
      }
    }
  }, [speakingLanguage]);

  useEffect(() => {
    if (!roomId || !userName || !userId) return;

    if (!TRANSLATION_URL) {
      setIsConnected(false);
      console.error(SERVICE_CONFIG_ERRORS.translation);
      return;
    }

    const playedAudioMessageIds = playedAudioMessageIdsRef.current;

    socketRef.current = io(TRANSLATION_URL, {
      transports: ["websocket", "polling"],
      timeout: 10000,
    });

    socketRef.current.on("connect", () => {
      console.log("[TRANSLATE] Connected to translation server");
      setIsConnected(true);
      setConnectionError("");

      console.log("[TRANSLATE] Joining room:", { userId, userName, roomId, preferredLanguage: languageRef.current });
      socketRef.current.emit("join-translation", {
        userId,
        userName,
        roomId,
        preferredLanguage: languageRef.current,
      });
    });

    socketRef.current.on("connect_error", (error) => {
      setIsConnected(false);
      setConnectionError(
        `Cannot reach the translation server at ${TRANSLATION_URL}. ${
          error?.message || "connection failed"
        }`
      );
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from translation server");
      setIsConnected(false);
    });

    socketRef.current.on("translation-joined", (data) => {
      console.log("Translation joined:", data);
      if (data?.language) {
        const language = normalizeLanguage(data.language);
        languageRef.current = language;
        setCurrentLanguage(language);
      }

      /* Start recognition once, after the translation socket is ready.
         Participants should not need to press "Translate" to be heard;
         a listener who does not speak still receives captions/audio. */
      if (!autoStartedListeningRef.current) {
        autoStartedListeningRef.current = true;

        setTimeout(() => {
          if (!socketRef.current?.connected) return;
          startListeningRef.current?.({ silent: true, automatic: true });
        }, 1200);
      }
    });

    socketRef.current.on("language-changed", (data) => {
      console.log("Language changed:", data);
      if (data?.language) {
        const language = normalizeLanguage(data.language);
        languageRef.current = language;
        setCurrentLanguage(language);
      }
    });

    socketRef.current.on("translated-caption", (data) => {
      console.log("[TRANSLATE] Caption received:", { speaker: data.speaker, hasText: !!data.text, hasTrans: !!data.translatedText, msgId: data.messageId });

      if (!translationEnabledRef.current) {
        return;
      }

      /* A caption that was already in flight when the participant
         changed language belongs to the previous language. Showing it
         would make it look as if the new language failed. */
      if (
        data.targetLanguage &&
        normalizeLanguage(data.targetLanguage) !== languageRef.current
      ) {
        console.log(
          "Skipping caption for stale language:",
          data.targetLanguage,
          "current:",
          languageRef.current
        );
        return;
      }

      const translatedText = data.translatedText || "";
      const sequence = captionSequenceRef.current + 1;
      captionSequenceRef.current = sequence;

      setCaption({
        speaker: data.speaker || "",
        originalText: data.text || "",
        translatedText,
        translationError:
          data.translationError || (!translatedText && !data.isOriginal ? "Translation unavailable" : ""),
        isOriginal: data.isOriginal || false,
        targetLanguage: normalizeLanguage(
          data.targetLanguage || languageRef.current
        ),
      });

      if (captionClearTimeoutRef.current) {
        clearTimeout(captionClearTimeoutRef.current);
      }

      captionClearTimeoutRef.current = setTimeout(() => {
        if (captionSequenceRef.current !== sequence) return;

        setCaption((prev) => ({
          ...prev,
          translatedText: "",
        }));
      }, 7000);
    });

    socketRef.current.on("tts-audio", (data = {}) => {
      console.log("[TRANSLATE] TTS audio received:", {
        speaker: data.speaker,
        language: data.language,
        hasAudio: Boolean(data.audio),
        messageId: data.messageId,
        hasText: !!data.translatedText,
      });

      if (!translationEnabledRef.current) {
        return;
      }

      if (
        data.language &&
        normalizeLanguage(data.language) !== languageRef.current
      ) {
        console.log(
          "Skipping translated audio for stale language:",
          data.language,
          "current:",
          languageRef.current
        );
        return;
      }

      if (
        data.messageId &&
        playedAudioMessageIdsRef.current.has(data.messageId)
      ) {
        console.log("Skipping duplicate translated audio:", data.messageId);
        return;
      }

      if (data.messageId) {
        playedAudioMessageIdsRef.current.add(data.messageId);

        if (playedAudioMessageIdsRef.current.size > 200) {
          const oldest = playedAudioMessageIdsRef.current.values().next().value;
          playedAudioMessageIdsRef.current.delete(oldest);
        }
      }

      if (data.audio) {
        console.log("[TRANSLATE] Playing server TTS audio");
        enqueueTranslatedAudio(data.audio, data.mimeType);
      } else if (data.translatedText) {
        // Fallback to browser TTS when server TTS is unavailable
        console.log("[TRANSLATE] No server audio, using browser TTS fallback");
        const langForTTS = speechLanguageFor(
          normalizeLanguage(data.language || languageRef.current)
        );
        enqueueBrowserTTS(data.translatedText, langForTTS);
      } else {
        console.warn("tts-audio event received but no audio found and no text");
      }
    });

    socketRef.current.emit("get-languages");

    socketRef.current.on("available-languages", (languages) => {
      if (languages) setAvailableLanguages(languages);
    });

    return () => {
      shouldListenRef.current = false;
      captionSequenceRef.current += 1;

      if (captionClearTimeoutRef.current) {
        clearTimeout(captionClearTimeoutRef.current);
        captionClearTimeoutRef.current = null;
      }

      audioQueueRef.current = [];
      isPlayingAudioRef.current = false;
      audioBlockedRef.current = false;
      playedAudioMessageIds.clear();
      lastFinalTextRef.current = { text: "", at: 0 };

      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [
    roomId,
    userName,
    userId,
    enqueueTranslatedAudio,
  ]);

  const changeLanguage = useCallback(
    (newLanguage) => {
      const language = normalizeLanguage(newLanguage);
      languageRef.current = language;
      setCurrentLanguage(language);

      /* Anything queued in the previous language must not be spoken
         after the switch. */
      audioQueueRef.current = [];
      audioBlockedRef.current = false;
      setAudioError("");

      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause();
          currentAudioRef.current.currentTime = 0;
        } catch {
          // ignore
        }
        currentAudioRef.current = null;
      }

      isPlayingAudioRef.current = false;

      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }

      if (socketRef.current && isConnected) {
        socketRef.current.emit("change-language", {
          userId,
          newLanguage: language,
        });
      }
    },
    [userId, isConnected]
  );

  /* Changing the spoken language never changes the language this
     participant wants to receive. It only changes recognition and the
     source language sent with the next transcript. */
  const changeSpeakingLanguage = useCallback((newLanguage) => {
    const language = normalizeLanguage(newLanguage);
    speakingLanguageRef.current = language;
    setSpeakingLanguage(language);
  }, []);

  const startListening = useCallback((options = {}) => {
    const silent = Boolean(options?.silent);
    automaticStartRef.current = Boolean(options?.automatic);

    if (!socketRef.current || !isConnected) {
      console.error("Not connected to translation server");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (!silent) alert("Speech Recognition not supported. Use Chrome.");
      return;
    }

    // Prevent multiple instances
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    shouldListenRef.current = true;

    const recognition = new SpeechRecognition();

    // Use continuous false for better control, restart handled manually
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = speechLanguageFor(speakingLanguageRef.current);

    recognition.onstart = () => {
      console.log("Speech recognition started");
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();

        if (!transcript) continue;

        if (event.results[i].isFinal) {
          console.log("Final transcript:", transcript);

          const normalizedText = transcript
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
          const now = Date.now();
          const previous = lastFinalTextRef.current;

          if (
            previous.text === normalizedText &&
            now - previous.at < 3000
          ) {
            console.log(
              "Skipping duplicate final transcript:",
              transcript
            );
            return;
          }

          lastFinalTextRef.current = { text: normalizedText, at: now };

          if (socketRef.current && socketRef.current.connected) {
            console.log("[TRANSLATE] Sending speech-text:", { userId, text: transcript, sourceLanguage: speakingLanguageRef.current });
            socketRef.current.emit("speech-text", {
              userId,
              text: transcript,
              originalLanguage: speakingLanguageRef.current,
              sourceLanguage: speakingLanguageRef.current,
              isInterim: false,
            });
          }
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        console.log("Interim:", interimTranscript);
      }
    };

    recognition.onerror = (event) => {
      // Handle expected errors separately
      if (event.error === "aborted") {
        console.log("Recognition aborted (expected during restart/stop)");
        return;
      }
      if (event.error === "no-speech") {
        console.log("No speech detected");
        return;
      }

      console.error("Recognition error:", event.error);

      if (event.error === "audio-capture") {
        if (!automaticStartRef.current) alert("No microphone detected.");
        setIsListening(false);
        shouldListenRef.current = false;
        return;
      }

      if (event.error === "not-allowed") {
        if (!automaticStartRef.current) alert("Microphone access denied.");
        setIsListening(false);
        shouldListenRef.current = false;
        return;
      }
    };

    recognition.onend = () => {
      console.log("Speech recognition ended");

      if (shouldListenRef.current && recognitionRef.current === recognition) {
        setTimeout(() => {
          if (!shouldListenRef.current) return;
          if (recognitionRef.current !== recognition) return;

          try {
            recognition.start();
          } catch (error) {
            console.error("Restart failed:", error);
            // Don't create infinite loop on persistent errors
            setTimeout(() => {
              if (shouldListenRef.current && recognitionRef.current === recognition) {
                try {
                  recognition.start();
                } catch (e) {
                  console.error("Second restart failed:", e);
                  shouldListenRef.current = false;
                  setIsListening(false);
                }
              }
            }, 2000);
          }
        }, 800);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error("Failed to start recognition:", error);
      setIsListening(false);
      shouldListenRef.current = false;
      recognitionRef.current = null;
    }
  }, [isConnected, userId]);

  startListeningRef.current = startListening;

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);

    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
    lastFinalTextRef.current = { text: "", at: 0 };

    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      currentAudioRef.current = null;
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  /* Translation mode controls receiving only. It is intentionally
     decoupled from the microphone/recognition: a listener may receive
     translated audio without ever pressing "Translate", and disabling
     translation restores the original remote audio. */
  const setTranslationEnabled = useCallback((enabled) => {
    const next = Boolean(enabled);
    translationEnabledRef.current = next;
    setTranslationEnabledState(next);

    if (typeof window !== "undefined") {
      window.translationReceivingEnabled = next;
    }

    if (!next) {
      audioQueueRef.current = [];
      isPlayingAudioRef.current = false;
      audioBlockedRef.current = false;
      setAudioError("");

      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause();
          currentAudioRef.current.currentTime = 0;
        } catch {
          // ignore
        }
        currentAudioRef.current = null;
      }

      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const toggleTranslation = useCallback(() => {
    setTranslationEnabled(!translationEnabledRef.current);
  }, [setTranslationEnabled]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isConnected,
    connectionError,
    currentLanguage,
    speakingLanguage,
    availableLanguages,
    caption,
    isListening,
    translationEnabled,
    audioError,
    changeLanguage,
    changeSpeakingLanguage,
    startListening,
    stopListening,
    toggleListening,
    toggleTranslation,
    setTranslationEnabled,
  };
};