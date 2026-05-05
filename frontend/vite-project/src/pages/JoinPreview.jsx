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
  const [aiAnchor, setAiAnchor] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [stream, setStream] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [anchoringSchedule, setAnchoringSchedule] = useState(null);
  const videoRef = useRef(null);

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
    }
  };

  getMedia();

  return () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
  };
}, []);

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
  const handleMeetingStart = () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!meetingId.trim()) {
      alert("Meeting ID is required");
      return;
    }

    // If AI anchor is enabled, show schedule setup first
    if (aiAnchor) {
      setShowScheduleModal(true);
      return;
    }

    // Otherwise, navigate directly to meeting
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
        aiAnchor,
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

          <input
            placeholder="Meeting ID"
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
          />

          {mode === "create" && (
            <div className="jp-regenerate">
              <button onClick={() => setMeetingId(generateMeetingId())}>
                New Meeting ID
              </button>
            </div>
          )}

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

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

              <label className="jp-toggle">
                <input
                  type="checkbox"
                  checked={aiAnchor}
                  onChange={() => setAiAnchor(!aiAnchor)}
                />
                AI Anchor Assistant
              </label>
            </>
          )}

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