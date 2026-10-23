import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "./JoinPreview.css";

import micOnIcon from "../assets/mic-on.jpg";
import micOffIcon from "../assets/mic-off.jpg";
import camOnIcon from "../assets/cam-on.webp";
import camOffIcon from "../assets/cam-off.jpg";

// Schedule Setup Modal Component
const ScheduleSetupModal = ({ isOpen, onClose, onSave, meetingTitle, setMeetingTitle }) => {
  const [scheduleItems, setScheduleItems] = useState([
    { speakerName: '', topic: '', duration: 5, role: '' }
  ]);
  const [anchorLanguage, setAnchorLanguage] = useState('en-US');

  const languages = [
    { code: 'en-US', name: 'English' },
    { code: 'hi-IN', name: 'Hindi' },
    { code: 'ml-IN', name: 'Malayalam' },
    { code: 'ta-IN', name: 'Tamil' }
  ];

  const addScheduleItem = () => {
    setScheduleItems([...scheduleItems, { speakerName: '', topic: '', duration: 5, role: '' }]);
  };

  const removeScheduleItem = (index) => {
    if (scheduleItems.length > 1) {
      setScheduleItems(scheduleItems.filter((_, i) => i !== index));
    }
  };

  const updateScheduleItem = (index, field, value) => {
    const updated = [...scheduleItems];
    updated[index][field] = value;
    setScheduleItems(updated);
  };

  const handleSave = () => {
    const validSchedule = scheduleItems.filter(item => item.speakerName.trim() !== '');
    if (validSchedule.length === 0) {
      alert('Please add at least one speaker to the schedule');
      return;
    }
    onSave({
      meetingTitle: meetingTitle || 'Meeting',
      schedule: validSchedule,
      language: anchorLanguage
    });
  };

  const totalDuration = scheduleItems.reduce((sum, item) => sum + (parseInt(item.duration) || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎤 Set Up AI Anchor Schedule</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="form-group">
            <label>Meeting Title</label>
            <input
              type="text"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="Enter meeting title"
            />
          </div>

          <div className="form-group">
            <label>Anchor Language</label>
            <select value={anchorLanguage} onChange={(e) => setAnchorLanguage(e.target.value)}>
              {languages.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>

          <div className="schedule-section">
            <div className="section-header">
              <h3>Speaker Schedule</h3>
              <span className="total-time">Total: {totalDuration} min</span>
            </div>

            <div className="schedule-list">
              {scheduleItems.map((item, index) => (
                <div key={index} className="schedule-item-form">
                  <div className="item-number">{index + 1}</div>
                  
                  <div className="item-fields">
                    <div className="field-row">
                      <input
                        type="text"
                        placeholder="Speaker Name"
                        value={item.speakerName}
                        onChange={(e) => updateScheduleItem(index, 'speakerName', e.target.value)}
                        className="name-input"
                      />
                      <input
                        type="text"
                        placeholder="Role (e.g., Presenter, Host)"
                        value={item.role}
                        onChange={(e) => updateScheduleItem(index, 'role', e.target.value)}
                        className="role-input"
                      />
                    </div>

                    <div className="field-row">
                      <input
                        type="text"
                        placeholder="Topic / Content"
                        value={item.topic}
                        onChange={(e) => updateScheduleItem(index, 'topic', e.target.value)}
                        className="topic-input"
                      />
                      <div className="duration-field">
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={item.duration}
                          onChange={(e) => updateScheduleItem(index, 'duration', parseInt(e.target.value) || 5)}
                          className="duration-input"
                        />
                        <span>min</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    className="remove-btn"
                    onClick={() => removeScheduleItem(index)}
                    disabled={scheduleItems.length === 1}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>

            <button className="add-btn" onClick={addScheduleItem}>
              + Add Speaker
            </button>
          </div>

          <div className="info-box">
            <h4>How AI Anchoring Works:</h4>
            <ul>
              <li>🎤 AI anchor introduces each speaker automatically</li>
              <li>⏱️ Timer tracks each speaker's allocated time</li>
              <li>🔔 1-minute and 30-second warnings announced</li>
              <li>🔇 Auto-mutes speaker when time is up</li>
              <li>🗣️ Smooth transitions between speakers</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>
            Start Meeting with AI Anchor
          </button>
        </div>
      </div>
    </div>
  );
};

export default function JoinPreview() {
  const { mode } = useParams(); // create | join
  const navigate = useNavigate();
  const location = useLocation();

  /* ---------- HELPERS ---------- */
  const generateMeetingId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const generatePassword = () =>
    Math.random().toString(36).substring(2, 10);

  /* ---------- STATE ---------- */
  const [name, setName] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [password, setPassword] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [language, setLanguage] = useState("en");
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [stream, setStream] = useState(null);
  const [mediaError, setMediaError] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [, setAnchoringSchedule] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const copyFeedbackTimerRef = useRef(null);

  /* Entry state handed over by the quick-join form on /start.
     Kept in a ref so the media effect can read it without
     adding `location.state` to its dependency list. */
  const entryState = useRef(location.state || null);

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

  /* ---------- MEDIA PREVIEW ---------- */
  useEffect(() => {
    let cancelled = false;

    const describeMediaError = (error) => {
      if (
        error?.name === "NotAllowedError" ||
        error?.name === "SecurityError"
      ) {
        return "Camera/microphone permission was denied. Allow access for this site in your browser, then reload this page.";
      }
      if (
        error?.name === "NotFoundError" ||
        error?.name === "DevicesNotFoundError"
      ) {
        return "No camera or microphone was found. Connect a device and try again.";
      }
      if (
        error?.name === "NotReadableError" ||
        error?.name === "TrackStartError"
      ) {
        return "The camera or microphone is already in use by another application. Close it and try again.";
      }
      return `Could not start the camera or microphone: ${
        error?.message || "unknown error"
      }`;
    };

    const getMedia = async () => {
      let mediaStream = null;

      try {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (initialError) {
          if (initialError?.name === "NotAllowedError") throw initialError;

          // A missing camera/microphone should not prevent the preview
          // when the other device is available.
          for (const constraints of [
            { video: false, audio: true },
            { video: true, audio: false },
          ]) {
            try {
              mediaStream = await navigator.mediaDevices.getUserMedia(
                constraints
              );
              break;
            } catch {
              // Try the other device.
            }
          }

          if (!mediaStream) throw initialError;
        }

        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = mediaStream;
        setStream(mediaStream);

        /* Seed the requested entry state: the quick-join form on
           /start can ask to join with the camera or the mic off. */
        const entry = entryState.current;
        const videoOff = Boolean(entry?.videoOff);
        const micOff = Boolean(entry?.micOff);

        mediaStream.getVideoTracks().forEach((track) => {
          track.enabled = !videoOff;
        });
        mediaStream.getAudioTracks().forEach((track) => {
          track.enabled = !micOff;
        });

        setCamOn(
          Boolean(mediaStream.getVideoTracks()[0]?.enabled)
        );
        setMicOn(
          Boolean(mediaStream.getAudioTracks()[0]?.enabled)
        );
        setMediaError(
          mediaStream.getVideoTracks().length === 0
            ? "No camera was found. You can still join with audio only."
            : mediaStream.getAudioTracks().length === 0
              ? "No microphone was found. You can still join with video only."
              : ""
        );
        setStream(mediaStream);
      } catch (err) {
        console.error("Preview media error:", err);
        if (!cancelled) setMediaError(describeMediaError(err));
      }
    };

    getMedia();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  useEffect(
    () => () => {
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
    },
    []
  );

  /* ---------- COPY FEEDBACK ---------- */
  const showCopyFeedback = (message, type = "success") => {
    setCopyFeedback({ message, type });

    if (copyFeedbackTimerRef.current) {
      clearTimeout(copyFeedbackTimerRef.current);
    }

    copyFeedbackTimerRef.current = setTimeout(() => {
      setCopyFeedback(null);
      copyFeedbackTimerRef.current = null;
    }, 2400);
  };

  const copyText = async (value, label) => {
    const text = String(value ?? "");

    if (!text.trim()) {
      showCopyFeedback(`There is no ${label.toLowerCase()} to copy.`, "error");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Clipboard API fallback for browsers that only expose execCommand.
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);

        try {
          textarea.select();
          const copied = document.execCommand("copy");

          if (!copied) {
            throw new Error("The browser rejected the copy command");
          }
        } finally {
          document.body.removeChild(textarea);
        }
      }

      showCopyFeedback(`${label} copied to clipboard.`);
    } catch (error) {
      console.error(`Could not copy ${label}:`, error);
      showCopyFeedback(
        `${label} could not be copied. Please copy it manually.`,
        "error"
      );
    }
  };

  /* ---------- MICROPHONE TOGGLE ---------- */
  const toggleMic = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];

    if (!audioTrack) {
      setMediaError(
        "No microphone track is available. Check the device and browser permission, then reload."
      );
      return;
    }

    audioTrack.enabled = !audioTrack.enabled;
    setMicOn(audioTrack.enabled);
  };

  /* ---------- CAMERA TOGGLE ---------- */
  const toggleCam = async () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];

    if (videoTrack) {
      // Disabling the track keeps the microphone and the permission
      // grant intact. Stopping every track here was why turning the
      // camera off also killed the microphone.
      videoTrack.enabled = !videoTrack.enabled;
      setCamOn(videoTrack.enabled);
      return;
    }

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      const newTrack = cameraStream.getVideoTracks()[0];
      if (!newTrack) return;

      const previous = streamRef.current;
      const nextStream = previous
        ? new MediaStream(previous.getTracks())
        : new MediaStream();

      nextStream.addTrack(newTrack);
      streamRef.current = nextStream;
      setStream(nextStream);
      setCamOn(true);
      setMediaError("");
    } catch (err) {
      console.error("Camera toggle error:", err);
      setMediaError(
        err?.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in this browser."
          : "The camera could not be started. Check that it is connected and not in use."
      );
    }
  };
  /* ---------- HANDLE START / JOIN ---------- */
  const handleMeetingStart = () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!meetingId.trim()) {
      alert("Meeting ID is required");
      return;
    }

    // AI anchoring is enabled from the meeting dashboard, not from the
    // pre-join screen, so joining never opens the schedule modal here.
    navigateToMeeting();
  };

  const navigateToMeeting = (scheduleData = null) => {
    navigate(`/meeting/${meetingId}`, {
      state: {
        meetingId,
        name,
        mode,
        micOn,
        camOn,
        language,
        waitingRoom,
        isCreator: mode === "create",
        userId: 'user_' + Math.random().toString(36).substr(2, 9),
        anchoringSchedule: scheduleData,
      },
    });
  };

  const handleScheduleSave = (scheduleData) => {
    setAnchoringSchedule(scheduleData);
    setShowScheduleModal(false);
    navigateToMeeting(scheduleData);
  };

  return (
    <div className="jp-container">

      {/* ---------- TOP BAR ---------- */}
      <div className="jp-top-info">
        <h2>{mode === "create" ? "Create Meeting" : "Join Meeting"}</h2>
      </div>

      {/* ---------- MAIN CONTENT ---------- */}
      <div className="jp-main">

        {/* ---------- LEFT DETAILS ---------- */}
        <div className="jp-details">

          <input
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="jp-input-wrap">
            <input
              placeholder="Meeting ID"
              aria-label="Meeting ID"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
            />
            <div className="jp-input-actions">
              <button
                type="button"
                className="jp-input-action"
                onClick={() => copyText(meetingId, "Meeting ID")}
                title="Copy meeting ID"
                aria-label="Copy meeting ID"
              >
                <svg
                  aria-hidden="true"
                  focusable="false"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>

          {mode === "create" && (
            <div className="jp-regenerate">
              <button onClick={() => setMeetingId(generateMeetingId())}>
                New Meeting ID
              </button>
            </div>
          )}

          <div className="jp-input-wrap jp-input-wrap--password">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              aria-label="Meeting password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="jp-input-actions">
              <button
                type="button"
                className="jp-input-action"
                onClick={() => setShowPassword((visible) => !visible)}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.6 6.8a9.8 9.8 0 0 1 1.4-.3c6 0 9.5 5.5 9.5 5.5a16.4 16.4 0 0 1-2.2 2.8" />
                    <path d="M6.4 7.9A16.7 16.7 0 0 0 2.5 12s3.5 5.5 9.5 5.5c1.3 0 2.5-.3 3.6-.7" />
                    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
                    <circle cx="12" cy="12" r="2.7" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="jp-input-action"
                onClick={() => copyText(password, "Meeting password")}
                title="Copy meeting password"
                aria-label="Copy meeting password"
              >
                <svg
                  aria-hidden="true"
                  focusable="false"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>

          {mode === "create" && (
            <div className="jp-regenerate">
              <button onClick={() => setPassword(generatePassword())}>
                Set Default Password
              </button>
            </div>
          )}

          {mode === "create" && (
            <>
              <textarea placeholder="Meeting Agenda" />

              <label className="jp-toggle">
                <input
                  type="checkbox"
                  checked={waitingRoom}
                  onChange={() => setWaitingRoom(!waitingRoom)}
                />
                Waiting Room
              </label>
            </>
          )}

          <div className="jp-field">
            <select
              aria-label="Preferred language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="en">English</option>
              <option value="ml">Malayalam</option>
              <option value="hi">Hindi</option>
              <option value="ta">Tamil</option>
              <option value="te">Telugu</option>
              <option value="kn">Kannada</option>
              <option value="bn">Bengali</option>
              <option value="gu">Gujarati</option>
              <option value="mr">Marathi</option>
              <option value="pa">Punjabi</option>
              <option value="as">Assamese</option>
              <option value="ur">Urdu</option>
            </select>
          </div>

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
            <button
              type="button"
              onClick={toggleMic}
              title={micOn ? "Mute microphone" : "Unmute microphone"}
              aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
            >
              <img
                src={micOn ? micOnIcon : micOffIcon}
                alt={micOn ? "Microphone on" : "Microphone off"}
              />
            </button>

            <button
              type="button"
              onClick={toggleCam}
              title={camOn ? "Turn camera off" : "Turn camera on"}
              aria-label={camOn ? "Turn camera off" : "Turn camera on"}
            >
              <img
                src={camOn ? camOnIcon : camOffIcon}
                alt={camOn ? "Camera on" : "Camera off"}
              />
            </button>
          </div>

          {mediaError && (
            <div className="jp-media-error" role="alert">
              {mediaError}
            </div>
          )}
        </div>
      </div>

      {/* ---------- ACTION BUTTON ---------- */}
      <button
        className="jp-action-btn"
        onClick={handleMeetingStart}
      >
        {mode === "create" ? "Start" : "Join"}
      </button>

      {copyFeedback && (
        <div
          className="jp-toast-region"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className={`oi-toast oi-toast--${copyFeedback.type}`}>
            <span className="oi-toast-title">{copyFeedback.message}</span>
          </div>
        </div>
      )}

      {/* ---------- SCHEDULE SETUP MODAL ---------- */}
      <ScheduleSetupModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSave={handleScheduleSave}
        meetingTitle={meetingTitle}
        setMeetingTitle={setMeetingTitle}
      />

    </div>
  );
}