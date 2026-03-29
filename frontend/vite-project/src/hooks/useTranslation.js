import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const languageNames = {
  'en': 'English',
  'ml': 'Malayalam',
  'hi': 'Hindi',
  'ta': 'Tamil',
  'te': 'Telugu',
  'kn': 'Kannada',
  'bn': 'Bengali',
  'gu': 'Gujarati',
  'mr': 'Marathi',
  'od': 'Odia',
  'pa': 'Punjabi',
  'as': 'Assamese',
  'ur': 'Urdu'
};

export const useTranslation = (roomId, userName, userId, preferredLanguage = 'en') => {
  const socketRef = useRef(null);
  const recognitionRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(preferredLanguage);
  const [availableLanguages, setAvailableLanguages] = useState(languageNames);
  const [caption, setCaption] = useState({
    speaker: '',
    originalText: '',
    translatedText: '',
    isOriginal: false,
    targetLanguage: preferredLanguage
  });
  const [isListening, setIsListening] = useState(false);

  // Connect to translation server
  useEffect(() => {
    if (!roomId || !userName || !userId) return;

    socketRef.current = io("http://localhost:5000", {
      transports: ['websocket', 'polling'],
      timeout: 10000
    });

    socketRef.current.on("connect", () => {
      console.log("✅ Connected to translation server");
      setIsConnected(true);
      
      // Join with preferred language
      socketRef.current.emit("join-translation", {
        userId,
        userName,
        roomId,
        preferredLanguage: currentLanguage
      });
    });

    socketRef.current.on("disconnect", () => {
      setIsConnected(false);
    });

    // Handle translation joined confirmation
    socketRef.current.on("translation-joined", (data) => {
      console.log("🌍 Translation joined:", data);
      setCurrentLanguage(data.language);
    });

    // Handle language change confirmation
    socketRef.current.on("language-changed", (data) => {
      console.log("🔄 Language changed to:", data.languageName);
      setCurrentLanguage(data.language);
    });

    // Handle translated captions
    socketRef.current.on("translated-caption", (data) => {
      console.log("📝 Caption received:", data);
      setCaption({
        speaker: data.speaker,
        originalText: data.text,
        translatedText: data.translatedText,
        isOriginal: data.isOriginal,
        targetLanguage: data.targetLanguage
      });
      
      // Auto-clear caption after 5 seconds
      setTimeout(() => {
        setCaption(prev => ({
          ...prev,
          translatedText: ''
        }));
      }, 5000);
    });

    // Handle TTS audio
    socketRef.current.on("tts-audio", (data) => {
      console.log("🔊 TTS audio received from:", data.speaker);
      playAudio(data.audio);
    });

    // Get available languages
    socketRef.current.emit("get-languages");
    socketRef.current.on("available-languages", (languages) => {
      setAvailableLanguages(languages);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [roomId, userName, userId]);

  // Play base64 audio
  const playAudio = useCallback((base64Audio) => {
    try {
      const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
      audio.volume = 0.8;
      audio.play().catch(err => console.error("Audio play error:", err));
    } catch (e) {
      console.error("Audio error:", e);
    }
  }, []);

  // Change language
  const changeLanguage = useCallback((newLanguage) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("change-language", {
        userId,
        newLanguage
      });
    }
  }, [userId, isConnected]);

  // Start speech recognition
  const startListening = useCallback(() => {
    if (!socketRef.current || !isConnected) {
      console.error("❌ Not connected to translation server");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition not supported in this browser");
      return;
    }

    // Stop existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true; // Enable interim results for faster capture
    recognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy
    
    // Set language based on current preference
    const langMap = {
      'en': 'en-US',
      'ml': 'ml-IN',
      'hi': 'hi-IN',
      'ta': 'ta-IN',
      'te': 'te-IN',
      'kn': 'kn-IN',
      'bn': 'bn-IN',
      'gu': 'gu-IN',
      'mr': 'mr-IN',
      'od': 'or-IN',
      'pa': 'pa-IN',
      'as': 'as-IN',
      'ur': 'ur-IN'
    };
    recognition.lang = langMap[currentLanguage] || 'en-US';

    let finalTranscript = '';
    let interimTranscript = '';

    recognition.onstart = () => {
      console.log("🎤 Speech recognition started");
      setIsListening(true);
      finalTranscript = '';
      interimTranscript = '';
    };

    recognition.onresult = (event) => {
      interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          console.log("🎤 Final recognized:", transcript);
          
          if (transcript && transcript.trim().length > 1) {
            // Send to translation server immediately
            socketRef.current.emit("speech-text", {
              userId,
              text: transcript.trim(),
              originalLanguage: currentLanguage
            });
          }
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Log interim results for debugging
      if (interimTranscript) {
        console.log("🎤 Interim:", interimTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Recognition error:", event.error);
      
      // Don't stop on non-critical errors
      if (event.error === 'no-speech') {
        console.log("No speech detected, continuing...");
        return;
      }
      
      if (event.error === 'audio-capture') {
        console.error("No microphone detected");
        return;
      }
      
      if (event.error === 'not-allowed') {
        alert("Microphone access denied. Please allow microphone access.");
        setIsListening(false);
        return;
      }
      
      // For other errors, try to restart
      console.log("Attempting to restart recognition after error...");
    };

    recognition.onend = () => {
      console.log("🎤 Speech recognition ended");
      // Always restart if we're supposed to be listening
      if (isListening) {
        console.log("🔄 Restarting recognition...");
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.error("Failed to restart recognition:", e);
            // If restart fails, try creating a new instance
            setTimeout(() => startListening(), 500);
          }
        }, 100);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error("Failed to start recognition:", e);
    }
  }, [currentLanguage, isConnected, userId, isListening]);

  // Stop speech recognition
  const stopListening = useCallback(() => {
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  // Toggle listening
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
    toggleListening
  };
};
