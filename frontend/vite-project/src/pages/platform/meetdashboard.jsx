import { useEffect, useRef, useState } from "react";
import "./meetdashboard.css";

export default function MeetDashboard() {
  const localVideoRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setStream(s);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = s;
        }
      } catch (err) {
        console.error(err);
        alert("Please allow camera and microphone access");
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const toggleMic = () => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setMicOn(audioTrack.enabled);
  };

  const toggleCam = () => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;
    setCamOn(videoTrack.enabled);
  };

  return (
    <div className="base-container">
      {/* Top Bar */}
      <div className="top-bar">
        <img src="/src/assets/logo.png" alt="Logo" classNameName="logo-image" />
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Big video */}
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="main-video"
          style={{ display: camOn ? "block" : "none" }}
        />

        {/* If camera is off, show a placeholder */}
        {!camOn && <div className="main-video" style={{ display: "block" }} />}

        {/* Small videos grid */}
        <div className="side-videos">
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="controls">
        <button
          className={`control-btn ${micOn ? "" : "off"}`}
          onClick={toggleMic}
          title={micOn ? "Mute" : "Unmute"}
        >
          <img src="/src/assets/mic.png" alt="Mic" />
        </button>

        <button
          className={`control-btn ${camOn ? "" : "off"}`}
          onClick={toggleCam}
          title={camOn ? "Turn off camera" : "Turn on camera"}
        >
          <img src="/src/assets/camera.png" alt="Camera" />
        </button>

        <button className="control-btn">
          <img src="/src/assets/cc.png" alt="Captions" />
        </button>
        <button className="control-btn">
          <img src="/src/assets/hand.png" alt="Raise Hand" />
        </button>
        <button className="control-btn">
          <img src="/src/assets/share.png" alt="Share" />
        </button>
        <button className="control-btn">
          <img src="/src/assets/more.png" alt="More" />
        </button>
        <button className="control-btn end">
          <img src="/src/assets/hangup.png" alt="Hang Up" />
        </button>
      </div>
    </div>
  );
}
