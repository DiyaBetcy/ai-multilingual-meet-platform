import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "./JoinPreview.css";

import micOnIcon from "../assets/mic-on.jpg";
import micOffIcon from "../assets/mic-off.jpg";
import camOnIcon from "../assets/cam-on.webp";
import camOffIcon from "../assets/cam-off.jpg";

export default function JoinPreview() {
  const { mode } = useParams(); // create | join
  const navigate = useNavigate();
  const location = useLocation();

<<<<<<< HEAD
  const [introText, setIntroText] = useState(
    "Welcome everyone to today's meeting. We will now start the session."
  );

=======
  /* ---------- HELPERS ---------- */
>>>>>>> 5dc4dd52aee6a07e504a8702c018b8066770eca7
  const generateMeetingId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();
  const generatePassword = () =>
    Math.random().toString(36).substring(2, 10);

<<<<<<< HEAD
  // Languages not supported by browser
  const cloudTTSLanguages = ["hi", "ml", "ta"];

=======
  /* ---------- STATE ---------- */
>>>>>>> 5dc4dd52aee6a07e504a8702c018b8066770eca7
  const [name, setName] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [password, setPassword] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [aiAnchor, setAiAnchor] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

<<<<<<< HEAD
  // Agenda text
  const [agendaText, setAgendaText] = useState("");

  // Speakers
  const [speakers, setSpeakers] = useState([
    { name: "", topic: "", time: 60, language: "en" },
  ]);

  // ------------------ Speaker Functions ------------------
  const addSpeaker = () => {
    setSpeakers([
      ...speakers,
      { name: "", topic: "", time: 60, language: "en" },
    ]);
  };

  const updateSpeaker = (index, key, value) => {
    const newSpeakers = [...speakers];
    newSpeakers[index][key] = value;
    setSpeakers(newSpeakers);
  };

  // ------------------ AI Anchor TTS ------------------

  const isBrowserVoiceAvailable = (langCode) => {
    const voices = speechSynthesis.getVoices();
    return voices.some((v) => v.lang.startsWith(langCode));
  };

  const speakText = async (text, langCode) => {
    if (!text) return;

    if (cloudTTSLanguages.includes(langCode) || !isBrowserVoiceAvailable(langCode)) {
      // Cloud TTS fallback
      try {
        const res = await fetch(
          `http://localhost:3001/api/tts?text=${encodeURIComponent(text)}&lang=${langCode}`
        );
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        await audio.play();
        await new Promise((resolve) => (audio.onended = resolve));
      } catch (err) {
        console.error("Cloud TTS failed, fallback to English", err);
        if (langCode !== "en") await speakText(text, "en");
      }
    } else {
      // Browser TTS
      await new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = speechSynthesis.getVoices();
        const voice = voices.find((v) => v.lang.startsWith(langCode));
        if (voice) utterance.voice = voice;
        utterance.lang = langCode;
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.onend = resolve;
        speechSynthesis.speak(utterance);
      });
    }
  };

  const startAnchorFlow = async () => {
    // Speak introduction first
    await speakText(introText, "en");

    // Loop through each speaker
    for (let i = 0; i < speakers.length; i++) {
      const speaker = speakers[i];

      if (!speaker.name.trim() || !speaker.topic.trim()) continue;

      const announcement = `Next, ${speaker.name} will speak on ${speaker.topic}.`;

      // Speak speaker announcement
      await speakText(announcement, speaker.language);

      // Wait for speaker's allocated time
      await new Promise((resolve) => setTimeout(resolve, speaker.time * 1000));
=======
  /* ---------- AUTO GENERATE FOR CREATE ---------- */
useEffect(() => {
  if (mode === "create") {
    setMeetingId(generateMeetingId());
    setPassword(generatePassword());
  }

  if (mode === "join" && location.state?.meetingId) {
    setMeetingId(location.state.meetingId);
  }
}, [mode, location.state]);

  /* ---------- AUTO GENERATE FOR CREATE ---------- */
 useEffect(() => {
  let localStream;

  const getMedia = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStream = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      setCamOn(true);
    } catch (err) {
      console.error(err);
>>>>>>> 5dc4dd52aee6a07e504a8702c018b8066770eca7
    }

    // Conclude meeting
    await speakText(
      "That concludes the meeting agenda. Thank you everyone for your time.",
      "en"
    );
  };

  // ------------------ Media Controls ------------------
  const toggleMic = () => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setMicOn(audioTrack.enabled);
  };

<<<<<<< HEAD
  const toggleCam = async () => {
    try {
      if (camOn) {
        stream?.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
        setCamOn(false);
      } else {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        setStream(newStream);
        videoRef.current.srcObject = newStream;
        setCamOn(true);
      }
    } catch (err) {
      console.error(err);
=======
  getMedia();

  return () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
>>>>>>> 5dc4dd52aee6a07e504a8702c018b8066770eca7
    }
  };
}, []);

<<<<<<< HEAD
  // ------------------ Meeting Start ------------------
=======
/* ---------- MICROPHONE TOGGLE ---------- */
const toggleMic = () => {
  if (!stream) return;

  const audioTrack = stream.getAudioTracks()[0];
  if (!audioTrack) return;

  audioTrack.enabled = !audioTrack.enabled;
  setMicOn(audioTrack.enabled);
};

/* ---------- CAMERA TOGGLE ---------- */

const toggleCam = async () => {
  try {
    if (camOn) {
      // 🔥 TURN OFF CAMERA COMPLETELY
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setStream(null);
      setCamOn(false);

    } else {
      // 🔥 START BRAND NEW CAMERA STREAM
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      setCamOn(true);
    }
  } catch (err) {
    console.error("Camera toggle error:", err);
  }
};
  /* ---------- HANDLE START / JOIN ---------- */
>>>>>>> 5dc4dd52aee6a07e504a8702c018b8066770eca7
  const handleMeetingStart = () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!meetingId.trim()) {
      alert("Meeting ID is required");
      return;
    }

<<<<<<< HEAD
    if (aiAnchor) {
      startAnchorFlow(); // Start AI anchor sequence
    }

    navigate(`/meeting/${meetingId}`, {
      state: {
        username: name,
        meetingId,
=======
    navigate(`/meeting/${meetingId}`, {
      state: {
        meetingId,
        name,
>>>>>>> 5dc4dd52aee6a07e504a8702c018b8066770eca7
        mode,
        micOn,
        camOn,
        aiAnchor,
        waitingRoom,
<<<<<<< HEAD
        password,
        speakers,
=======
>>>>>>> 5dc4dd52aee6a07e504a8702c018b8066770eca7
      },
    });
  };

  // ------------------ Initialize Media ------------------
  useEffect(() => {
    if (mode === "create") {
      setMeetingId(generateMeetingId());
      setPassword(generatePassword());
    }
    if (mode === "join" && location.state?.meetingId) {
      setMeetingId(location.state.meetingId);
    }

    let localStream;
    const getMedia = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
        setCamOn(true);
      } catch (err) {
        console.error(err);
      }
    };
    getMedia();
    return () => localStream?.getTracks().forEach((t) => t.stop());
  }, [mode, location.state]);

  // ------------------ Render ------------------
  return (
    <div className="jp-container">
<<<<<<< HEAD
      <h2>{mode === "create" ? "Create Meeting" : "Join Meeting"}</h2>

      <div
        className="jp-main-row"
        style={{
          display: "flex",
          gap: "20px",
          alignItems: "flex-start",
        }}
      >
        {/* Left Column */}
        <div className="jp-details" style={{ flex: 1, minWidth: "280px" }}>
=======

      {/* ---------- TOP BAR ---------- */}
      <div className="jp-top-info">
        <h2>{mode === "create" ? "Create Meeting" : "Join Meeting"}</h2>
      </div>

      {/* ---------- MAIN CONTENT ---------- */}
      <div className="jp-main">

        {/* ---------- LEFT DETAILS ---------- */}
        <div className="jp-details">

>>>>>>> 5dc4dd52aee6a07e504a8702c018b8066770eca7
          <input
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Meeting ID"
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
          />
          {mode === "create" && (
<<<<<<< HEAD
            <button onClick={() => setMeetingId(generateMeetingId())}>
              New Meeting ID
            </button>
          )}
=======
            <div className="jp-regenerate">
              <button onClick={() => setMeetingId(generateMeetingId())}>
                New Meeting ID
              </button>
            </div>
          )}

>>>>>>> 5dc4dd52aee6a07e504a8702c018b8066770eca7
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
<<<<<<< HEAD
          {mode === "create" && (
            <button onClick={() => setPassword(generatePassword())}>
              Set Default Password
            </button>
=======

          {mode === "create" && (
            <div className="jp-regenerate">
              <button onClick={() => setPassword(generatePassword())}>
                Set Default Password
              </button>
            </div>
>>>>>>> 5dc4dd52aee6a07e504a8702c018b8066770eca7
          )}

          {mode === "create" && (
            <>
<<<<<<< HEAD
              <textarea
                placeholder="Meeting Agenda"
                value={agendaText}
                onChange={(e) => setAgendaText(e.target.value)}
              />
=======
              <textarea placeholder="Meeting Agenda" />
>>>>>>> 5dc4dd52aee6a07e504a8702c018b8066770eca7

              <label>
                <input
                  type="checkbox"
                  checked={waitingRoom}
                  onChange={() => setWaitingRoom(!waitingRoom)}
                />
                Waiting Room
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={aiAnchor}
                  onChange={() => setAiAnchor(!aiAnchor)}
                />
                AI Anchor Assistant
              </label>

              <textarea
                placeholder="Introduction for AI Anchor"
                value={introText}
                onChange={(e) => setIntroText(e.target.value)}
              />

              <div className="speakers-section">
                <h3>Speakers & Agenda</h3>
                {speakers.map((speaker, index) => (
                  <div key={index} className="speaker-row">
                    <input
                      type="text"
                      placeholder="Speaker Name"
                      value={speaker.name}
                      onChange={(e) =>
                        updateSpeaker(index, "name", e.target.value)
                      }
                    />
                    <input
                      type="text"
                      placeholder="Topic"
                      value={speaker.topic}
                      onChange={(e) =>
                        updateSpeaker(index, "topic", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      placeholder="Time (seconds)"
                      value={speaker.time}
                      onChange={(e) =>
                        updateSpeaker(index, "time", Number(e.target.value))
                      }
                    />
                    <select
                      value={speaker.language}
                      onChange={(e) =>
                        updateSpeaker(index, "language", e.target.value)
                      }
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="ml">Malayalam</option>
                      <option value="ta">Tamil</option>
                    </select>
                  </div>
                ))}
                <button onClick={addSpeaker}>Add Speaker</button>
              </div>

              <button className="jp-action-btn" onClick={handleMeetingStart}>
                {mode === "create" ? "Start" : "Join"}
              </button>
            </>
          )}
<<<<<<< HEAD
        </div>

        {/* Right Column: Video Preview & Controls */}
        <div
          className="jp-video-section"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minWidth: "340px",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "320px",
              height: "240px",
              borderRadius: "8px",
              backgroundColor: "#000",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "15px",
              marginTop: "8px",
            }}
          >
            <button
              onClick={toggleMic}
              style={{ border: "none", background: "none", cursor: "pointer" }}
            >
              <img
                src={micOn ? micOnIcon : micOffIcon}
                alt="Mic"
                style={{ width: "32px", height: "32px" }}
              />
            </button>
            <button
              onClick={toggleCam}
              style={{ border: "none", background: "none", cursor: "pointer" }}
            >
              <img
                src={camOn ? camOnIcon : camOffIcon}
                alt="Cam"
                style={{ width: "32px", height: "32px" }}
              />
            </button>
          </div>
        </div>
      </div>
=======

          {mode === "join" && (
            <div className="jp-field">
              <select>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="ml">Malayalam</option>
                <option value="ta">Tamil</option>
              </select>
            </div>
          )}

        </div>

        {/* ---------- RIGHT VIDEO ---------- */}
        <div className="jp-video-section">
          <div className="jp-video-box">
  <video
    ref={videoRef}
    autoPlay
    playsInline
    muted
    style={{ width: "100%", height: "100%" }}
  />
</div>

          <div className="jp-controls">
            <button onClick={toggleMic}>
  <img src={micOn ? micOnIcon : micOffIcon} alt="mic" />
</button>

            <button onClick={toggleCam}>
  <img src={camOn ? camOnIcon : camOffIcon} alt="cam" />
</button>
          </div>
        </div>
      </div>

      {/* ---------- ACTION BUTTON ---------- */}
      <button
        className="jp-action-btn"
        onClick={handleMeetingStart}
      >
        {mode === "create" ? "Start" : "Join"}
      </button>

>>>>>>> 5dc4dd52aee6a07e504a8702c018b8066770eca7
    </div>
  );
}