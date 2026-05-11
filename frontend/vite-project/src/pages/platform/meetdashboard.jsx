import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useWebRTC } from "../../hooks/useWebRTC.js";
import { useTranslation } from "../../hooks/useTranslation.js";
import { useAnchoring } from "../../hooks/useAnchoring.js";
import VideoGrid from "../../components/VideoGrid.jsx";
import LanguageSelector from "../../components/LanguageSelector.jsx";
import TranslatedCaption from "../../components/TranslatedCaption.jsx";
import AnchoringControlPanel from "../../components/AnchoringControlPanel.jsx";
import ScheduleSetupModal from "../../components/ScheduleSetupModal.jsx";
import "./meetdashboard.css";
import Popup from "./popup.jsx";
import ParticipantsPanel from "./participantspanel.jsx";
import ChatPanel from "./chatpanel.jsx";

export default function MeetDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { meetingId: urlMeetingId } = useParams();

  const meetingInfo = location.state || {};

  const {
    name,
    mode,
    micOn: previewMicOn,
    camOn: previewCamOn,
    meetingId: stateMeetingId,
  } = meetingInfo;

  const meetingId = urlMeetingId || stateMeetingId;

  const [tempUserId] = useState(
    () => "user_" + Math.random().toString(36).substr(2, 9)
  );

  const finalUserId = meetingInfo.userId || tempUserId;
  const userName = name || "Guest";

  console.log("Navigation state:", location.state);
  console.log("URL params meetingId:", urlMeetingId);
  console.log("Final meeting ID:", meetingId);
  console.log("Final user ID:", finalUserId);
  console.log("User name:", userName);

  const {
    isConnected,
    participants: rtcParticipants,
    messages: rtcMessages,
    isMuted,
    isVideoOff,
    isScreenSharing,
    handRaised,
    speakingUser,
    initializeLocalMedia,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    toggleHandRaise,
    sendMessage: rtcSendMessage,
    cleanup,
    setLocalVideoRef,
    localStream,
  } = useWebRTC(meetingId, userName, finalUserId);

  const {
    isConnected: translationConnected,
    currentLanguage,
    availableLanguages,
    caption,
    isListening,
    changeLanguage,
    toggleListening,
  } = useTranslation(meetingId, userName, finalUserId, "en");

  useEffect(() => {
  window.translationModeOn = isListening;

  const remoteVideos = document.querySelectorAll("video[id^='video-']");

  remoteVideos.forEach((video) => {
    video.muted = isListening;
    video.volume = isListening ? 0 : 1;
  });

  console.log(
    isListening
      ? "Translation ON: original audio muted"
      : "Translation OFF: original audio unmuted"
  );
}, [isListening]);

  const isCreator = meetingInfo.isCreator || false;

  const {
    isAnchoringEnabled,
    isActive: isAnchoringActive,
    schedule,
    currentSpeaker,
    currentIndex,
    timeRemaining,
    announcement,
    isMutedByAnchor,
    showScheduleModal,
    setShowScheduleModal,
    formatTime: formatAnchorTime,
    enableAnchoring,
    startAnchoring,
    pauseAnchoring,
    resumeAnchoring,
    skipSpeaker,
    stopAnchoring,
    resetAnchoring,
    updateAnchorLanguage,
    isSpeaking,
  } = useAnchoring(
    meetingId,
    finalUserId,
    userName,
    isCreator,
    currentLanguage
  );

  const [showPopup, setShowPopup] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [meetingSeconds, setMeetingSeconds] = useState(0);
  const [meetingRunning, setMeetingRunning] = useState(true);
  const [micOn, setMicOn] = useState(previewMicOn ?? true);
  const [camOn, setCamOn] = useState(previewCamOn ?? false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [anchorAudioUrl, setAnchorAudioUrl] = useState(null);

  const anchorAudioRef = useRef(null);

  useEffect(() => {
    if (isConnected && userName && meetingId) {
      initializeLocalMedia(camOn, micOn);
    }
  }, [isConnected, userName, meetingId, camOn, micOn, initializeLocalMedia]);

  const unlockAudio = () => {
    if (!audioUnlocked && anchorAudioRef.current) {
      anchorAudioRef.current
        .play()
        .then(() => {
          anchorAudioRef.current.pause();
          setAudioUnlocked(true);
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    const handleClick = () => unlockAudio();
    document.addEventListener("click", handleClick, { once: true });
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!meetingRunning) return;

    const interval = setInterval(() => {
      setMeetingSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [meetingRunning]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  useEffect(() => {
    if (isMutedByAnchor && !isMuted) {
      toggleMicrophone();
    }
  }, [isMutedByAnchor, isMuted, toggleMicrophone]);

  useEffect(() => {
    if (
      isCreator &&
      meetingInfo.anchoringSchedule &&
      !isAnchoringEnabled &&
      isConnected
    ) {
      enableAnchoring(meetingInfo.anchoringSchedule);
    }
  }, [
    isCreator,
    meetingInfo.anchoringSchedule,
    isAnchoringEnabled,
    isConnected,
    enableAnchoring,
  ]);

  useEffect(() => {
    if (
      isCreator &&
      isAnchoringEnabled &&
      !isAnchoringActive &&
      schedule.length > 0
    ) {
      startAnchoring();
    }
  }, [
    isCreator,
    isAnchoringEnabled,
    isAnchoringActive,
    schedule.length,
    startAnchoring,
  ]);

  useEffect(() => {
    if (updateAnchorLanguage && currentLanguage) {
      updateAnchorLanguage(currentLanguage);
    }
  }, [currentLanguage, updateAnchorLanguage]);

  useEffect(() => {
    if (announcement && announcement.audioUrl && anchorAudioRef.current) {
      setAnchorAudioUrl(announcement.audioUrl);
      anchorAudioRef.current.play().catch(console.error);
    }
  }, [announcement]);

  const anchorParticipant = isAnchoringEnabled
    ? {
        id: "ai-anchor",
        name: "AI Anchor",
        userId: "ai-anchor",
        isAnchor: true,
        avatar: "🎤",
        isSpeaking: isSpeaking,
        micOn: true,
      }
    : null;

  const allParticipants = anchorParticipant
    ? [...rtcParticipants, anchorParticipant]
    : rtcParticipants;

  const handleToggleMic = async () => {
    const micIsNowOn = await toggleMicrophone();
    setMicOn(micIsNowOn);
  };

  const handleToggleCam = async () => {
    const camIsNowOn = await toggleCamera();
    setCamOn(camIsNowOn);
  };

  const handleToggleScreenShare = async () => {
    await toggleScreenShare();
  };

  const handleToggleHandRaise = () => {
    toggleHandRaise();
  };

  const handleEndMeeting = () => {
    window.translationModeOn = false;
    cleanup();
    navigate("/");
  };

  const handleSendMessage = (message) => {
    rtcSendMessage(message);
  };

  const testConnection = () => {
    console.log("WebRTC connected:", isConnected);
    console.log("Translation connected:", translationConnected);
    console.log("Translation listening:", isListening);
    console.log("Meeting ID:", meetingId);
    console.log("User ID:", finalUserId);
    console.log("Participants:", rtcParticipants);
  };

  if (!meetingId) {
    return (
      <div className="meet-dashboard">
        <div className="meet-header">
          <h3>Meeting ID missing</h3>
          <button onClick={() => navigate("/")}>Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="meet-dashboard">
      <div className="meet-header">
        <div className="meet-info">
          <h3>Meeting: {meetingId}</h3>
          <span className="timer">{formatTime(meetingSeconds)}</span>
          <span
            className={`connection-status ${
              isConnected ? "connected" : "disconnected"
            }`}
          >
            {isConnected ? "🟢 Connected" : "🔴 Connecting..."}
          </span>
        </div>

        <LanguageSelector
          currentLanguage={currentLanguage}
          availableLanguages={availableLanguages}
          onChangeLanguage={changeLanguage}
          isListening={isListening}
          onToggleListening={toggleListening}
        />

        <div className="meet-controls">
          <button
            onClick={handleToggleMic}
            className={`control-btn ${!isMuted ? "active" : "muted"}`}
          >
            {!isMuted ? "🎤" : "🔇"}
          </button>

          <button
            onClick={handleToggleCam}
            className={`control-btn ${!isVideoOff ? "active" : "off"}`}
          >
            {!isVideoOff ? "📹" : "📵"}
          </button>

          <button
            onClick={handleToggleScreenShare}
            className={`control-btn ${isScreenSharing ? "active" : ""}`}
          >
            🖥️
          </button>

          <button
            onClick={handleToggleHandRaise}
            className={`control-btn ${handRaised ? "raised" : ""}`}
          >
            ✋
          </button>

          <button
            onClick={() => setCaptionsEnabled(!captionsEnabled)}
            className={`control-btn ${captionsEnabled ? "active" : ""}`}
          >
            📝
          </button>

          <button onClick={() => setShowChat(!showChat)} className="control-btn">
            💬
          </button>

          <button
            onClick={() => setShowPeople(!showPeople)}
            className="control-btn"
          >
            👥
          </button>

          <button onClick={testConnection} className="control-btn debug">
            🐛
          </button>

          <button onClick={handleEndMeeting} className="control-btn end-call">
            📞
          </button>
        </div>
      </div>

      <div className="meet-content">
        <div className="video-section">
          <VideoGrid
            participants={allParticipants}
            localStream={localStream}
            userName={userName}
            setLocalVideoRef={setLocalVideoRef}
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            handRaised={handRaised}
            speakingUser={speakingUser}
          />

          <TranslatedCaption caption={caption} isVisible={captionsEnabled} />
        </div>

        <div className="side-panels">
          <AnchoringControlPanel
            isCreator={isCreator}
            isAnchoringEnabled={isAnchoringEnabled}
            isActive={isAnchoringActive}
            schedule={schedule}
            currentSpeaker={currentSpeaker}
            currentIndex={currentIndex}
            timeRemaining={timeRemaining}
            timeFormatted={formatAnchorTime(timeRemaining)}
            onEnableAnchoring={() => setShowScheduleModal(true)}
            onStartAnchoring={startAnchoring}
            onPauseAnchoring={pauseAnchoring}
            onResumeAnchoring={resumeAnchoring}
            onSkipSpeaker={skipSpeaker}
            onStopAnchoring={stopAnchoring}
            onResetAnchoring={resetAnchoring}
            onOpenSchedule={() => setShowScheduleModal(true)}
          />

          {showPeople && (
            <ParticipantsPanel
              participants={allParticipants}
              onClose={() => setShowPeople(false)}
              speakingUser={speakingUser}
            />
          )}

          {showChat && (
            <ChatPanel
              messages={rtcMessages}
              onSendMessage={handleSendMessage}
              onClose={() => setShowChat(false)}
            />
          )}
        </div>
      </div>

      {announcement && (
        <div className="anchor-announcement-overlay">
          <div className="announcement-box">
            <div className="announcement-header">
              <span className="announcement-icon">🎤</span>
              <span className="announcement-speaker">
                {announcement.speakerName}
              </span>
            </div>
            <p className="announcement-text">{announcement.script}</p>
          </div>
        </div>
      )}

      {isMutedByAnchor && (
        <div className="muted-notification">
          🔇 Your time is up! Microphone muted by AI Anchor
        </div>
      )}

      {showScheduleModal && (
        <ScheduleSetupModal
          onClose={() => setShowScheduleModal(false)}
          onSave={(settings) => {
            enableAnchoring(settings);
            setShowScheduleModal(false);
          }}
          participants={rtcParticipants}
          currentLanguage={currentLanguage}
        />
      )}

      {showPopup && <Popup onClose={() => setShowPopup(false)} />}

      <audio
        ref={anchorAudioRef}
        src={anchorAudioUrl}
        onEnded={() => setAnchorAudioUrl(null)}
        style={{ display: "none" }}
      />
    </div>
  );
}