import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

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
  const languageRef = useRef(normalizeLanguage(initialLanguage));
  const captionClearTimeoutRef = useRef(null);
  const captionSequenceRef = useRef(0);

  const [isConnected, setIsConnected] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(() =>
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
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const unlockAudio = useCallback(() => {
    if (audioUnlocked) return;
    try {
      if (typeof window !== "undefined") {
        const audio = new Audio();
        audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
        audio.volume = 0;
        audio.play().then(() => {
          audio.pause();
          setAudioUnlocked(true);
          console.log("[TRANSLATE] Audio unlocked");
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

  const getTranslationUrl = () => {
    if (import.meta.env.VITE_TRANSLATION_URL) {
      return import.meta.env.VITE_TRANSLATION_URL;
    }
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host && host !== "localhost" && host !== "127.0.0.1") {
        return `http://${host}:5000`;
      }
    }
    return "http://localhost:5000";
  };

  const TRANSLATION_URL = getTranslationUrl();

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
          playNextAudio();
          resolve();
        };

        utterance.onerror = (err) => {
          console.error("Browser TTS error:", err);
          isPlayingAudioRef.current = false;
          playNextAudio();
          reject(err);
        };

        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error("Browser TTS setup error:", error);
        isPlayingAudioRef.current = false;
        reject(error);
      }
    });
  }, [getSpeechSynthesisVoice]);

  const playNextAudio = useCallback(() => {
    if (isPlayingAudioRef.current) return;

    const nextAudio = audioQueueRef.current.shift();
    if (!nextAudio) return;

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

      audio.onended = () => {
        isPlayingAudioRef.current = false;
        playNextAudio();
      };

      audio.onerror = (err) => {
        console.error("Translated audio playback error:", err);
        isPlayingAudioRef.current = false;
        playNextAudio();
      };

      audio.play().catch((err) => {
        console.error("Audio play blocked/error:", err);
        // Try to unlock and retry
        unlockAudio();
        isPlayingAudioRef.current = false;
        setTimeout(() => {
          audio.play().catch(() => {
            playNextAudio();
          });
        }, 1000);
      });
    } catch (error) {
      console.error("Audio playback setup error:", error);
      isPlayingAudioRef.current = false;
    }
  }, [speakWithBrowserTTS]);

  const enqueueTranslatedAudio = useCallback(
    (base64Audio) => {
      if (!base64Audio) return;

      console.log("Adding translated audio to queue, length:", base64Audio.length);

      audioQueueRef.current.push(base64Audio);
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

  /* The language selector changes the user's preference; it must not
     recreate the socket (which briefly removed the user from the room). */
  useEffect(() => {
    languageRef.current = normalizeLanguage(currentLanguage);
  }, [currentLanguage]);

  /* If the preferred language changes while the mic is active, restart
     recognition with the matching BCP-47 locale. */
  useEffect(() => {
    const recognition = recognitionRef.current;
    const nextLocale = speechLanguageFor(currentLanguage);

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
  }, [currentLanguage]);

  useEffect(() => {
    if (!roomId || !userName || !userId) return;

    const playedAudioMessageIds = playedAudioMessageIdsRef.current;

    socketRef.current = io(TRANSLATION_URL, {
      transports: ["websocket", "polling"],
      timeout: 10000,
    });

    socketRef.current.on("connect", () => {
      console.log("[TRANSLATE] Connected to translation server");
      setIsConnected(true);

      console.log("[TRANSLATE] Joining room:", { userId, userName, roomId, preferredLanguage: languageRef.current });
      socketRef.current.emit("join-translation", {
        userId,
        userName,
        roomId,
        preferredLanguage: languageRef.current,
      });
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
        enqueueTranslatedAudio(data.audio);
      } else if (data.translatedText) {
        // Fallback to browser TTS when server TTS is unavailable
        console.log("[TRANSLATE] No server audio, using browser TTS fallback");
        const langForTTS = data.language || speechLanguageFor(normalizeLanguage(data.targetLanguage || languageRef.current));
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
  }, [roomId, userName, userId, TRANSLATION_URL, enqueueTranslatedAudio]);

  const changeLanguage = useCallback(
    (newLanguage) => {
      const language = normalizeLanguage(newLanguage);
      languageRef.current = language;
      setCurrentLanguage(language);

      if (socketRef.current && isConnected) {
        socketRef.current.emit("change-language", {
          userId,
          newLanguage: language,
        });
      }
    },
    [userId, isConnected]
  );

  const startListening = useCallback(() => {
    if (!socketRef.current || !isConnected) {
      console.error("Not connected to translation server");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech Recognition not supported. Use Chrome.");
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
    recognition.lang = speechLanguageFor(languageRef.current);

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
            console.log("[TRANSLATE] Sending speech-text:", { userId, text: transcript, lang: languageRef.current });
            socketRef.current.emit("speech-text", {
              userId,
              text: transcript,
              originalLanguage: languageRef.current,
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
        alert("No microphone detected.");
        setIsListening(false);
        shouldListenRef.current = false;
        return;
      }

      if (event.error === "not-allowed") {
        alert("Microphone access denied.");
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

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);

    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
    lastFinalTextRef.current = { text: "", at: 0 };
    
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

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isConnected,
    currentLanguage,
    availableLanguages,
    caption,
    isListening,
    changeLanguage,
    startListening,
    stopListening,
    toggleListening,
  };
};