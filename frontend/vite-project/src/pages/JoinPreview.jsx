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

  const generateMeetingId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const generatePassword = () =>
    Math.random().toString(36).substring(2, 10);

  const [name, setName] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [password, setPassword] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [aiAnchor, setAiAnchor] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState("ml-IN");
  const [agenda, setAgenda] = useState("");
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);

  const videoRef = useRef(null);

  useEffect(() => {
    if (mode === "create") {
      setMeetingId(generateMeetingId());
      setPassword(generatePassword());
    }

    if (mode === "join" && location.state?.meetingId) {
      setMeetingId(location.state.meetingId);
    }
  }, [mode, location.state]);

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

        const audioTrack = mediaStream.getAudioTracks()[0];
        const videoTrack = mediaStream.getVideoTracks()[0];

        if (audioTrack) {
          audioTrack.enabled = micOn;
        }

        if (videoTrack) {
          videoTrack.enabled = camOn;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Preview media error:", err);
        setMicOn(false);
        setCamOn(false);
      }
    };

    getMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleMic = async () => {
    try {
      if (!stream) return;

      let audioTrack = stream.getAudioTracks()[0];

      if (!audioTrack) {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        audioTrack = audioStream.getAudioTracks()[0];
        stream.addTrack(audioTrack);
      }

      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    } catch (err) {
      console.error("Mic toggle error:", err);
    }
  };

  const toggleCam = async () => {
    try {
      if (!stream) return;

      let videoTrack = stream.getVideoTracks()[0];

      if (!videoTrack) {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });

        videoTrack = camStream.getVideoTracks()[0];
        stream.addTrack(videoTrack);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }

      videoTrack.enabled = !videoTrack.enabled;
      setCamOn(videoTrack.enabled);
    } catch (err) {
      console.error("Camera toggle error:", err);
    }
  };

  const handleMeetingStart = async () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!meetingId.trim()) {
      alert("Meeting ID is required");
      return;
    }

    if (mode === "join" && !password.trim()) {
      alert("Please enter the meeting password");
      return;
    }

    setLoading(true);

    try {
      navigate(`/meeting/${meetingId}`, {
        state: {
          name: name.trim(),
          mode,
          meetingId: meetingId.trim(),
          password: password.trim(),
          micOn,
          camOn,
          aiAnchor,
          waitingRoom,
          preferredLanguage,
          agenda,
        },
      });
    } catch (err) {
      console.error("Navigation error:", err);
      alert("Unable to continue to the meeting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="jp-container">
      <div className="jp-top-info">
        <h2>{mode === "create" ? "Create Meeting" : "Join Meeting"}</h2>
      </div>

      <div className="jp-main">
        <div className="jp-details">
          <input
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            placeholder="Meeting ID"
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value.toUpperCase())}
          />

          {mode === "create" && (
            <div className="jp-regenerate">
              <button
                type="button"
                onClick={() => setMeetingId(generateMeetingId())}
              >
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
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
              >
                Set Default Password
              </button>
            </div>
          )}

          {mode === "create" && (
            <>
              <textarea
                placeholder="Meeting Agenda"
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
              />

              <label className="jp-toggle">
                <input
                  type="checkbox"
                  checked={waitingRoom}
                  onChange={() => setWaitingRoom((prev) => !prev)}
                />
                Waiting Room
              </label>

              <label className="jp-toggle">
                <input
                  type="checkbox"
                  checked={aiAnchor}
                  onChange={() => setAiAnchor((prev) => !prev)}
                />
                AI Anchor Assistant
              </label>
            </>
          )}

          <div className="jp-field">
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
            >
              <option value="en-US">English</option>
              <option value="hi-IN">Hindi</option>
              <option value="ml-IN">Malayalam</option>
              <option value="ta-IN">Tamil</option>
            </select>
          </div>
        </div>

        <div className="jp-video-section">
          <div className="jp-video-box">
            {camOn ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#1f1f1f",
                  color: "white",
                  fontSize: "18px",
                }}
              >
                {name.trim() || "Camera Off"}
              </div>
            )}
          </div>

          <div className="jp-controls">
            <button type="button" onClick={toggleMic}>
              <img src={micOn ? micOnIcon : micOffIcon} alt="mic" />
            </button>

            <button type="button" onClick={toggleCam}>
              <img src={camOn ? camOnIcon : camOffIcon} alt="cam" />
            </button>
          </div>
        </div>
      </div>

      <button
        className="jp-action-btn"
        onClick={handleMeetingStart}
        disabled={loading}
      >
        {loading ? "Please wait..." : mode === "create" ? "Start" : "Join"}
      </button>
    </div>
  );
}