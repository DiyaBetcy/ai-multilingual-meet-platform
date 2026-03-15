import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./meetdashboard.css";
import Popup from "./popup.jsx";
import ParticipantsPanel from "./ParticipantsPanel.jsx";
import ChatPanel from "./ChatPanel.jsx";

export default function MeetDashboard() {

  const localVideoRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const previewMicOn = location.state?.micOn ?? true;
  const previewCamOn = location.state?.camOn ?? false;

  const [showPopup, setShowPopup] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [meetingSeconds, setMeetingSeconds] = useState(0);
  const [meetingRunning, setMeetingRunning] = useState(true);

  const [stream, setStream] = useState(new MediaStream());
  const [micOn, setMicOn] = useState(previewMicOn);
  const [camOn, setCamOn] = useState(false);

  const [isSharing, setIsSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [screenWarning, setScreenWarning] = useState(false);

  const screenStreamRef = useRef(null);

  /* attach stream to video element */
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  /* cleanup media on unmount */
  useEffect(() => {
    return () => {
      stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  /* meeting timer */
  useEffect(() => {
    if (!meetingRunning) return;

    const interval = setInterval(() => {
      setMeetingSeconds(s => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [meetingRunning]);

  /* reset unread when chat opened */
  useEffect(() => {
    if (showChat) {
      setUnreadCount(0);
    }
  }, [showChat]);

  /* apply preview settings */
  useEffect(() => {

    const applyPreviewSettings = async () => {

      if (previewCamOn) {
        await toggleCam();
      }

      if (previewMicOn) {
        await toggleMic();
      }

    };

    applyPreviewSettings();

  }, []);

  /* MICROPHONE */

  const toggleMic = async () => {

    const existingAudio = stream.getAudioTracks()[0];

    if (!existingAudio) {

      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      const audioTrack = audioStream.getAudioTracks()[0];

      stream.addTrack(audioTrack);

      setMicOn(true);
      return;
    }

    existingAudio.enabled = !existingAudio.enabled;
    setMicOn(existingAudio.enabled);
  };

  /* CAMERA */

  const startCamera = async () => {

    const camStream = await navigator.mediaDevices.getUserMedia({
      video: true
    });

    const videoTrack = camStream.getVideoTracks()[0];

    stream.addTrack(videoTrack);

    setCamOn(true);
  };

  const toggleCam = async () => {

    const existingVideo = stream.getVideoTracks()[0];

    if (!existingVideo) {
      await startCamera();
      return;
    }

    existingVideo.enabled = !existingVideo.enabled;
    setCamOn(existingVideo.enabled);
  };

  /* SCREEN SHARE */

  const startScreenShare = async () => {

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true
    });

    const screenTrack = displayStream.getVideoTracks()[0];

    const existingVideo = stream.getVideoTracks()[0];

    if (existingVideo) {
      stream.removeTrack(existingVideo);
    }

    stream.addTrack(screenTrack);

    setIsSharing(true);

    screenTrack.onended = () => {
      stopScreenShare();
    };
  };

  const stopScreenShare = () => {

    const screenTrack = stream.getVideoTracks()[0];

    if (screenTrack) {
      stream.removeTrack(screenTrack);
      screenTrack.stop();
    }

    setIsSharing(false);
    startCamera();
  };

  /* HAND RAISE */

  const toggleHandRaise = () => {
    setHandRaised(prev => !prev);
  };

  /* CHAT */

  const sendMessage = (text) => {

    const now = new Date();

    const time = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    setMessages(prev => [
      ...prev,
      {
        id: Date.now(),
        sender: "You",
        text,
        time
      }
    ]);

    if (!showChat) {
      setUnreadCount(c => c + 1);
    }
  };

  /* END MEETING */

  const endMeeting = () => {

    setMeetingRunning(false);

    if (isSharing) {
      stopScreenShare();
    }

    stream.getTracks().forEach(t => t.stop());

    setStream(new MediaStream());

    setCamOn(false);
    setMicOn(false);
    setIsSharing(false);
    setHandRaised(false);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    navigate("/start");
  };

  /* TIME FORMAT */

  const formatTime = (secs) => {

    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;

    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };

  const participants = [
    {
      id: "me",
      name: "You (Host)",
      isYou: true,
      micOn,
      camOn,
      handRaised
    }
  ];

  return (
    <div className="base-container">

      <div className="start-top-bar">
        <img src="/src/assets/logo.png" className="start-logo" />

        <div className="start-menu">

          <span onClick={() => navigate("/")}>Home</span>
          <span onClick={() => navigate("/meetings")}>Meetings</span>
          <span onClick={() => navigate("/settings")}>Settings</span>
          <span onClick={() => navigate("/profile")}>Profile</span>

        </div>
      </div>

      <div className="main-content">

        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="main-video"
          style={{ display: (camOn || isSharing) ? "block" : "none" }}
        />

        {!camOn && !isSharing && (
          <div className="main-video"></div>
        )}

        <div className="side-videos">
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
        </div>

      </div>

      <div className="controls">

        <button
          className={`control-btn ${micOn ? "" : "off"}`}
          onClick={toggleMic}
        >
          <img src="/src/assets/mic.png" alt="Mic"/>
        </button>

        <button
          className={`control-btn ${camOn ? "" : "off"}`}
          onClick={toggleCam}
        >
          <img src="/src/assets/camera.png" alt="Camera"/>
        </button>

        <button className="control-btn">
          <img src="/src/assets/cc.png" alt="Captions"/>
        </button>

        <button
          className={`control-btn ${handRaised ? "off" : ""}`}
          onClick={toggleHandRaise}
        >
          <img src="/src/assets/hand.png" alt="Raise Hand"/>
        </button>

        <button
          className="control-btn"
          onClick={() => setShowPeople(true)}
        >
          👥
        </button>

        <button
          className="control-btn chat-btn"
          onClick={() => setShowChat(true)}
        >
          💬
          {unreadCount > 0 && <span className="chat-badge">{unreadCount}</span>}
        </button>

        <button
          className={`control-btn ${isSharing ? "off" : ""}`}
          onClick={isSharing ? stopScreenShare : startScreenShare}
        >
          <img src="/src/assets/share.png" alt="Share"/>
        </button>

        <button
          className="control-btn"
          onClick={() => setShowPopup(true)}
        >
          <img src="/src/assets/more.png" alt="More"/>
        </button>

        <button
          className="control-btn end"
          onClick={endMeeting}
        >
          <img src="/src/assets/hangup.png" alt="Hang Up"/>
        </button>

      </div>

      <Popup open={showPopup} onClose={() => setShowPopup(false)} />

      <ParticipantsPanel
        open={showPeople}
        onClose={() => setShowPeople(false)}
        participants={participants}
      />

      <ChatPanel
        open={showChat}
        onClose={() => setShowChat(false)}
        messages={messages}
        onSend={sendMessage}
      />

      {screenWarning && (
        <div className="screen-warning-popup">
          <div className="popup-content">
            <p>
              ⚠ <strong>Entire Screen sharing is not supported.</strong><br/>
              Please select <strong>Chrome Tab</strong> or <strong>Window</strong>.
            </p>
            <button onClick={() => setScreenWarning(false)}>OK</button>
          </div>
        </div>
      )}

    </div>
  );
}