import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "./JoinPreview.css";

import micOnIcon from "../assets/mic-on.jpg";
import micOffIcon from "../assets/mic-off.jpg";
import camOnIcon from "../assets/cam-on.webp";
import camOffIcon from "../assets/cam-off.jpg";

export default function JoinPreview() {
  const { mode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

<<<<<<< HEAD
  const videoRef = useRef(null);

=======
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
  const generateMeetingId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const generatePassword = () =>
    Math.random().toString(36).substring(2, 10);

  const [name, setName] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [aiAnchor, setAiAnchor] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState("ml-IN");
  const [agenda, setAgenda] = useState("");
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);

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

<<<<<<< HEAD
        const audioTrack = mediaStream.getAudioTracks()[0];
        const videoTrack = mediaStream.getVideoTracks()[0];

        if (audioTrack) audioTrack.enabled = micOn;
        if (videoTrack) videoTrack.enabled = camOn;

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Preview media error:", err);
        setMicOn(false);
        setCamOn(false);
=======
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        setCamOn(true);
      } catch (err) {
        console.error(err);
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
      }
    };

    getMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
<<<<<<< HEAD
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
=======
  }, []);

  const toggleMic = () => {
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setMicOn(audioTrack.enabled);
  };

  const toggleCam = async () => {
    try {
      if (camOn) {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }

        setStream(null);
        setCamOn(false);
      } else {
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

  const handleMeetingStart = () => {
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!meetingId.trim()) {
      alert("Meeting ID is required");
      return;
    }

<<<<<<< HEAD
    if (!password.trim()) {
      alert("Please enter the meeting password");
      return;
    }

    setLoading(true);

    try {
      console.log("JoinPreview submit:", {
        mode,
        meetingId: meetingId.trim(),
        password: password.trim(),
        name: name.trim(),
      });

      navigate(`/meeting/${meetingId.trim()}`, {
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
      console.error("Meeting preview navigation error:", err);
      alert("Unable to continue to the meeting");
    } finally {
      setLoading(false);
    }
=======
    navigate(`/meeting/${meetingId}`, {
      state: {
        username: name,
        meetingId: meetingId,
        mode,
        micOn,
        camOn,
        aiAnchor,
        waitingRoom,
        password,
      },
    });
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
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

          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ flex: 1 }}
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                background: "white",
                cursor: "pointer",
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

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

<<<<<<< HEAD
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
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
        </div>

        <div className="jp-video-section">
          <div className="jp-video-box">
<<<<<<< HEAD
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
=======
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
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
              <img src={camOn ? camOnIcon : camOffIcon} alt="cam" />
            </button>
          </div>
        </div>
      </div>

<<<<<<< HEAD
      <button
        className="jp-action-btn"
        onClick={handleMeetingStart}
        disabled={loading}
      >
        {loading ? "Please wait..." : mode === "create" ? "Start" : "Join"}
=======
      <button className="jp-action-btn" onClick={handleMeetingStart}>
        {mode === "create" ? "Start" : "Join"}
>>>>>>> 8c7b860f831dc606110b96b1a4aa3425d749e81e
      </button>
    </div>
  );
}