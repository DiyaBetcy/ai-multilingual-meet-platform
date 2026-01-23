import { useEffect, useRef, useState } from "react";
import "./meetdashboard.css";
import Popup from "./popup.jsx";
export default function MeetDashboard() {
  const localVideoRef = useRef(null);
const [showPopup, setShowPopup] = useState(false);

  const [stream, setStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
const cameraStreamRef = useRef(null);


  useEffect(() => {
  // Google Meet style: do NOT auto start camera on page load
  return () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };
}, [stream]);


    

  const toggleMic = () => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setMicOn(audioTrack.enabled);
  };

    const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setStream(s);
      cameraStreamRef.current = s;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = s;
      }

      setCamOn(true);
      setMicOn(true);
    } catch (err) {
      console.error(err);
      alert("Please allow camera and microphone access");
    }
  };


    const toggleCam = async () => {
    // If camera stream is not started yet → start it
    if (!stream) {
      await startCamera();
      return;
    }

    // If stream exists → just toggle video track
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;
    setCamOn(videoTrack.enabled);
  };

    const startScreenShare = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
        

      // Show screen in main video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = displayStream;
      }

      setIsSharing(true);

      // When user stops sharing from browser UI
      const screenTrack = displayStream.getVideoTracks()[0];
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Screen share failed:", err);
      alert("Screen sharing cancelled or blocked.");
    }
  };
  const stopScreenShare = () => {
  const camStream = cameraStreamRef.current;

  if (camStream && localVideoRef.current) {
    localVideoRef.current.srcObject = camStream;
  }

  setIsSharing(false);
};


  return (
    <div className="base-container">
      {/* Top Bar */}
      <div className="top-bar">
        <img src="/src/assets/logo.png" alt="Logo" className="logo-image" />
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
          style={{ display: (camOn || isSharing) ? "block" : "none" }}

        />

        {!camOn && !isSharing && (
  <div className="main-video" style={{ display: "block" }} />
)}


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
        <button
  className={`control-btn ${isSharing ? "off" : ""}`}
  onClick={isSharing ? stopScreenShare : startScreenShare}
  title={isSharing ? "Stop sharing" : "Share screen"}
>
  <img src="/src/assets/share.png" alt="Share" />
</button>

        
  
        <button className="control-btn">
          <img src="/src/assets/more.png" alt="More" />
        </button>
        <button className="control-btn">
          <img src="/src/assets/share.png" alt="Share" />
        </button>
        <button
  className="control-btn"
  onClick={() => setShowPopup(true)}
>
  <img src="/src/assets/more.png" alt="More" />
</button>

        <button className="control-btn end">
          <img src="/src/assets/hangup.png" alt="Hang Up" />
        </button>
      </div>
      <Popup
  open={showPopup}
  onClose={() => setShowPopup(false)}
/>

    </div>
  );
}
