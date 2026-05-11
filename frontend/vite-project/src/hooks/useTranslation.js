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
  const lastFinalSentTimeRef = useRef(0);

  const [isConnected, setIsConnected] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage);
  const [availableLanguages, setAvailableLanguages] = useState(languageNames);
  const [caption, setCaption] = useState({
    speaker: "",
    originalText: "",
    translatedText: "",
    isOriginal: false,
    targetLanguage: initialLanguage,
  });
  const [isListening, setIsListening] = useState(false);

  const TRANSLATION_URL =
    import.meta.env.VITE_TRANSLATION_URL || "http://localhost:5000";

  const playNextAudio = useCallback(() => {
    if (isPlayingAudioRef.current) return;

    const nextAudio = audioQueueRef.current.shift();
    if (!nextAudio) return;

    try {
      isPlayingAudioRef.current = true;

      let audioSrc = nextAudio;

      if (!nextAudio.startsWith("data:audio")) {
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
        isPlayingAudioRef.current = false;
        playNextAudio();
      });
    } catch (error) {
      console.error("Audio playback setup error:", error);
      isPlayingAudioRef.current = false;
    }
  }, []);

  const enqueueTranslatedAudio = useCallback(
    (base64Audio) => {
      if (!base64Audio) return;

      console.log("Adding translated audio to queue, length:", base64Audio.length);

      audioQueueRef.current.push(base64Audio);
      playNextAudio();
    },
    [playNextAudio]
  );

  useEffect(() => {
    if (!roomId || !userName || !userId) return;

    socketRef.current = io(TRANSLATION_URL, {
      transports: ["websocket", "polling"],
      timeout: 10000,
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to translation server");
      setIsConnected(true);

      socketRef.current.emit("join-translation", {
        userId,
        userName,
        roomId,
        preferredLanguage: currentLanguage,
      });
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from translation server");
      setIsConnected(false);
    });

    socketRef.current.on("translation-joined", (data) => {
      console.log("Translation joined:", data);
      if (data?.language) setCurrentLanguage(data.language);
    });

    socketRef.current.on("language-changed", (data) => {
      console.log("Language changed:", data);
      if (data?.language) setCurrentLanguage(data.language);
    });

    socketRef.current.on("translated-caption", (data) => {
      console.log("Caption received:", data);

      const translatedText = data.translatedText || data.text || "";

      setCaption({
        speaker: data.speaker || "",
        originalText: data.text || "",
        translatedText,
        isOriginal: data.isOriginal || false,
        targetLanguage: data.targetLanguage || currentLanguage,
      });

      setTimeout(() => {
        setCaption((prev) => ({
          ...prev,
          translatedText: "",
        }));
      }, 7000);
    });

    socketRef.current.on("tts-audio", (data) => {
      console.log("TTS audio received:", data);

      if (data?.audio) {
        enqueueTranslatedAudio(data.audio);
      } else {
        console.warn("tts-audio event received but no audio found");
      }
    });

    socketRef.current.emit("get-languages");

    socketRef.current.on("available-languages", (languages) => {
      if (languages) setAvailableLanguages(languages);
    });

    return () => {
      shouldListenRef.current = false;

      audioQueueRef.current = [];
      isPlayingAudioRef.current = false;

      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [
    roomId,
    userName,
    userId,
    TRANSLATION_URL,
    currentLanguage,
    enqueueTranslatedAudio,
  ]);

  const changeLanguage = useCallback(
    (newLanguage) => {
      setCurrentLanguage(newLanguage);

      if (socketRef.current && isConnected) {
        socketRef.current.emit("change-language", {
          userId,
          newLanguage,
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

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    shouldListenRef.current = true;

    const recognition = new SpeechRecognition();

    // More stable for sentence-by-sentence demo
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = "en-US";

    let processingTimeout = null;

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

          const now = Date.now();

          // Prevent rapid duplicate/flood requests to Google Translate
          if (now - lastFinalSentTimeRef.current < 3500) {
            console.log("Skipping final transcript to avoid rate limit:", transcript);
            return;
          }

          lastFinalSentTimeRef.current = now;

          socketRef.current.emit("speech-text", {
            userId,
            text: transcript,
            originalLanguage: "en",
            targetLanguage: currentLanguage,
            isInterim: false,
          });
        } else {
          interimTranscript += transcript;

          // Do not send interim text to backend.
          // This avoids request spam and improves 2–3 sentence demo stability.
          clearTimeout(processingTimeout);
        }
      }

      if (interimTranscript) {
        console.log("Interim:", interimTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Recognition error:", event.error);

      if (event.error === "no-speech") return;

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

      if (shouldListenRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (error) {
            console.error("Restart failed:", error);
          }
        }, 1500);
      } else {
        setIsListening(false);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (error) {
      console.error("Failed to start recognition:", error);
      setIsListening(false);
      shouldListenRef.current = false;
    }
  }, [isConnected, userId, currentLanguage]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);

    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
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