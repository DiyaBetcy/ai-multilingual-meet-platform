
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
import QAPanel from "./QAPanel.jsx";
import ChatPanel from "./chatpanel.jsx";
import WaitingRoomPanel from "./WaitingRoomPanel.jsx";
import { getToken } from "../../lib/session.js";
import { TRANSLATION_URL } from "../../lib/serviceUrls.js";

const getSummaryApiBase = () => TRANSLATION_URL;

export default function MeetDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { meetingId: urlMeetingId } = useParams();
  const meetingInfo = location.state || {};

  const {
    name,
    micOn: previewMicOn,
    camOn: previewCamOn,
    meetingId: stateMeetingId,
    language: preferredLanguage,
  } = meetingInfo;

  const meetingId = urlMeetingId || stateMeetingId;
  const [tempUserId] = useState(
    () => "user_" + Math.random().toString(36).substring(2, 11)
  );

  const finalUserId = meetingInfo.userId || tempUserId;
  const userName = name || "Guest";
  const isCreator = Boolean(meetingInfo.isCreator);

  const {
    isConnected,
    connectionError,
    mediaError,
    participants: rtcParticipants,
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
    cleanup,
    setLocalVideoRef,
    localStream,
    qaQuestions,
    questionNotice,
    submitQuestion,
    answerQuestion,
    getQuestions,
    messages,
    sendMessage,
    waitingStatus,
    waitingMessage,
    waitingParticipants,
    isHost,
    admitParticipant,
    rejectParticipant,
  } = useWebRTC(meetingId, userName, finalUserId, {
    waitingRoom: Boolean(meetingInfo.waitingRoom),
    isCreator,
  });

  const {
    currentLanguage,
    speakingLanguage,
    availableLanguages,
    caption,
    isListening,
    translationEnabled,
    changeLanguage,
    changeSpeakingLanguage,
    toggleTranslation,
    toggleListening,
    isConnected: isTranslationConnected,
    connectionError: translationConnectionError,
  } = useTranslation(
    meetingId,
    userName,
    finalUserId,
    preferredLanguage || "en"
  );

  /* Translation mode is owned by the participant, not by the microphone.
     Mute only the remote WebRTC audio (the local preview/mic are never
     touched) so the translated TTS is not overlapped by the speaker's
     original-language voice. Turning translation off restores it. */
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    window.translationModeOn = Boolean(
      translationEnabled && isTranslationConnected
    );

    return () => {
      window.translationModeOn = false;
    };
  }, [translationEnabled, isTranslationConnected]);

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
    anchorAudioStatus,
    anchorAudioError,
    retryAnchorAudio,
    connectionError: anchoringConnectionError,
    canResume: canResumeAnchoring,
  } = useAnchoring(
    meetingId,
    finalUserId,
    userName,
    isCreator,
    currentLanguage
  );

  const [showPopup, setShowPopup] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [meetingSeconds, setMeetingSeconds] = useState(0);
  const [meetingRunning] = useState(true);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);

  const hasAutoStartedAnchoringRef = useRef(false);
  const anchorMutedRef = useRef(false);
  const initialMediaRef = useRef({
    micOn: previewMicOn ?? true,
    camOn: previewCamOn ?? true,
  });

  /* Acquire the local stream exactly once. Toggling the microphone or
     camera now only changes track.enabled; it never re-runs getUserMedia. */
  useEffect(() => {
    const { camOn, micOn } = initialMediaRef.current;
    initializeLocalMedia(camOn, micOn);
  }, [initializeLocalMedia]);

  useEffect(() => {
    if (!meetingRunning) return;
    const interval = setInterval(() => {
      setMeetingSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [meetingRunning]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainingSeconds}`;
  };

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    if (isMutedByAnchor && !isMuted) {
      anchorMutedRef.current = true;
      toggleMicrophone();
      return;
    }

    /* The anchoring service emits unmute-speaker for the next speaker.
       Only restore the microphone if the anchor muted it, so a manual
       mute by the participant is never undone. */
    if (!isMutedByAnchor && anchorMutedRef.current) {
      anchorMutedRef.current = false;
      if (isMuted) toggleMicrophone();
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
    if (!isAnchoringEnabled) {
      hasAutoStartedAnchoringRef.current = false;
      return;
    }

    /* Start once when a schedule is enabled. Pausing or stopping must
       not be undone by this effect immediately starting the session
       again. */
    if (
      isCreator &&
      !hasAutoStartedAnchoringRef.current &&
      schedule.length > 0
    ) {
      hasAutoStartedAnchoringRef.current = true;
      startAnchoring();
    }
  }, [
    isCreator,
    isAnchoringEnabled,
    schedule.length,
    startAnchoring,
  ]);

  useEffect(() => {
    if (updateAnchorLanguage && currentLanguage) {
      updateAnchorLanguage(currentLanguage);
    }
  }, [currentLanguage, updateAnchorLanguage]);

  const anchorParticipant = isAnchoringEnabled
    ? {
        id: "ai-anchor",
        name: "AI Anchor",
        userId: "ai-anchor",
        isAnchor: true,
        avatar: "🎤",
        isSpeaking,
        micOn: true,
      }
    : null;

  const allParticipants = anchorParticipant
    ? [...rtcParticipants, anchorParticipant]
    : rtcParticipants;

  const handleToggleMic = () => toggleMicrophone();
  const handleToggleCam = () => toggleCamera();

  const handleEndMeeting = () => {
    window.translationModeOn = false;
    cleanup();
    navigate("/");
  };

  const handleToggleQA = () => {
    const nextOpen = !showQA;
    setShowQA(nextOpen);
    if (nextOpen) getQuestions();
  };

  const handleToggleChat = () => setShowChat((open) => !open);
  const handleToggleSummary = () => {
    setShowSummary((open) => {
      const next = !open;
      if (next && !summary && !summaryLoading) {
        fetchSummary();
      }
      return next;
    });
  };

  const fetchSummary = async () => {
    if (!meetingId) return;
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const baseUrl = getSummaryApiBase();
      if (!baseUrl) {
        throw new Error(
          "The summary API is not configured. Set VITE_TRANSLATION_URL and redeploy the frontend."
        );
      }
      const token = getToken();
      const res = await fetch(`${baseUrl}/api/summary/${meetingId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setSummary(data.summary);
      } else if (res.status === 404) {
        setSummary(null);
      } else {
        setSummaryError(data?.error || "Failed to fetch summary");
      }
    } catch (err) {
      setSummaryError(err.message || "Failed to fetch summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  const generateSummary = async () => {
    if (!meetingId || summaryGenerating) return;
    setSummaryGenerating(true);
    setSummaryError("");
    try {
      const baseUrl = getSummaryApiBase();
      if (!baseUrl) {
        throw new Error(
          "The summary API is not configured. Set VITE_TRANSLATION_URL and redeploy the frontend."
        );
      }
      const token = getToken();
      const res = await fetch(`${baseUrl}/api/summary/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ meetingId, userId: finalUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setSummary(data.summary);
      } else {
        setSummaryError(data?.error || "Failed to generate summary");
      }
    } catch (err) {
      setSummaryError(err.message || "Failed to generate summary");
    } finally {
      setSummaryGenerating(false);
    }
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
          <span className={`connection-status ${isConnected ? "connected" : "disconnected"}`}>
            {isConnected ? "🟢 Connected" : "🔴 Connecting..."}
          </span>
        </div>

        <LanguageSelector
          currentLanguage={currentLanguage}
          speakingLanguage={speakingLanguage}
          availableLanguages={availableLanguages}
          onChangeLanguage={changeLanguage}
          onChangeSpeakingLanguage={changeSpeakingLanguage}
          isListening={isListening}
          translationEnabled={translationEnabled}
          onToggleTranslation={toggleTranslation}
          onToggleListening={toggleListening}
        />

        <div className="meet-controls">
          <button
            type="button"
            onClick={handleToggleMic}
            className={`control-btn ${!isMuted ? "active" : "muted"}`}
            title={!isMuted ? "Mute microphone" : "Unmute microphone"}
            aria-label={!isMuted ? "Mute microphone" : "Unmute microphone"}
          >
            {!isMuted ? "🎤" : "🔇"}
          </button>

          <button
            type="button"
            onClick={handleToggleCam}
            className={`control-btn ${!isVideoOff ? "active" : "off"}`}
            title={!isVideoOff ? "Turn camera off" : "Turn camera on"}
            aria-label={!isVideoOff ? "Turn camera off" : "Turn camera on"}
          >
            {!isVideoOff ? "📹" : "📵"}
          </button>

          <button
            type="button"
            onClick={toggleScreenShare}
            className={`control-btn ${isScreenSharing ? "active" : ""}`}
            title={isScreenSharing ? "Stop screen sharing" : "Share screen"}
            aria-label={isScreenSharing ? "Stop screen sharing" : "Share screen"}
          >
            🖥️
          </button>

          <button
            type="button"
            onClick={toggleHandRaise}
            className={`control-btn ${handRaised ? "raised" : ""}`}
            title={handRaised ? "Lower hand" : "Raise hand"}
            aria-label={handRaised ? "Lower hand" : "Raise hand"}
          >
            ✋
          </button>

          <button
            type="button"
            onClick={() => setCaptionsEnabled((enabled) => !enabled)}
            className={`control-btn ${captionsEnabled ? "active" : ""}`}
            title={captionsEnabled ? "Hide captions" : "Show captions"}
            aria-label={captionsEnabled ? "Hide captions" : "Show captions"}
            aria-pressed={captionsEnabled}
          >
            📝
          </button>

          <button
            type="button"
            onClick={handleToggleQA}
            className={`control-btn ${showQA ? "active" : ""}`}
            title={showQA ? "Close Q&A" : "Open Q&A"}
            aria-label={showQA ? "Close Q&A" : "Open Q&A"}
            aria-expanded={showQA}
          >
            ❓
          </button>

          <button
            type="button"
            onClick={handleToggleChat}
            className={`control-btn ${showChat ? "active" : ""}`}
            title={showChat ? "Close chat" : "Open chat"}
            aria-label={showChat ? "Close chat" : "Open chat"}
            aria-expanded={showChat}
          >
            💬
          </button>

          <button
            type="button"
            onClick={handleToggleSummary}
            className={`control-btn ${showSummary ? "active" : ""}`}
            title={showSummary ? "Close summary" : "Meeting Summary"}
            aria-label={showSummary ? "Close summary" : "Meeting Summary"}
            aria-expanded={showSummary}
          >
            📄
          </button>

          <button
            type="button"
            onClick={() => setShowPeople((open) => !open)}
            className="control-btn"
            title="Participants"
            aria-label="Participants"
            aria-expanded={showPeople}
          >
            👥
          </button>

          {/* The Text Connection/debug button has been removed. */}

          <button
            type="button"
            onClick={handleEndMeeting}
            className="control-btn end-call"
            title="Leave meeting"
            aria-label="Leave meeting"
          >
            📞
          </button>
        </div>
      </div>

      {(connectionError ||
        mediaError ||
        translationConnectionError ||
        anchoringConnectionError) && (
        <div className="meet-alert-stack">
          {connectionError && (
            <div className="meet-alert" role="alert">
              {connectionError}
            </div>
          )}
          {mediaError && (
            <div className="meet-alert" role="alert">
              {mediaError}
            </div>
          )}
          {translationConnectionError && (
            <div className="meet-alert" role="alert">
              {translationConnectionError}
            </div>
          )}
          {anchoringConnectionError && (
            <div className="meet-alert" role="alert">
              {anchoringConnectionError}
            </div>
          )}
        </div>
      )}

      {waitingStatus === "waiting" && (
        <div className="meet-waiting-gate" role="status" aria-live="polite">
          <div className="meet-waiting-card">
            <div className="meet-waiting-icon" aria-hidden="true">⏳</div>
            <h2>Waiting for admission</h2>
            <p>{waitingMessage || "The host will admit you shortly."}</p>
            <button
              type="button"
              className="meet-waiting-leave"
              onClick={handleEndMeeting}
            >
              Leave waiting room
            </button>
          </div>
        </div>
      )}

      {waitingStatus === "rejected" && (
        <div className="meet-waiting-gate" role="alert">
          <div className="meet-waiting-card">
            <div className="meet-waiting-icon" aria-hidden="true">🚫</div>
            <h2>You were not admitted</h2>
            <p>{waitingMessage}</p>
            <button
              type="button"
              className="meet-waiting-leave"
              onClick={handleEndMeeting}
            >
              Back to home
            </button>
          </div>
        </div>
      )}

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
            isSpeaking={isSpeaking}
            audioStatus={anchorAudioStatus}
            audioError={anchorAudioError}
            canResume={canResumeAnchoring}
            onRetryAudio={retryAnchorAudio}
            onStartAnchoring={startAnchoring}
            onPauseAnchoring={pauseAnchoring}
            onResumeAnchoring={resumeAnchoring}
            onSkipSpeaker={skipSpeaker}
            onStopAnchoring={stopAnchoring}
            onResetAnchoring={resetAnchoring}
            onOpenSchedule={() => setShowScheduleModal(true)}
          />

          {isHost && waitingParticipants.length > 0 && (
            <WaitingRoomPanel
              participants={waitingParticipants}
              onAdmit={admitParticipant}
              onReject={rejectParticipant}
            />
          )}

          {showPeople && (
            <ParticipantsPanel
              participants={allParticipants}
              onClose={() => setShowPeople(false)}
              speakingUser={speakingUser}
            />
          )}

          {showQA && (
            <QAPanel
              qaQuestions={qaQuestions}
              questionNotice={questionNotice}
              submitQuestion={submitQuestion}
              answerQuestion={answerQuestion}
              getQuestions={getQuestions}
              onClose={() => setShowQA(false)}
            />
          )}
        </div>
      </div>

      {showChat && (
        <ChatPanel
          messages={messages}
          onSendMessage={sendMessage}
          onClose={() => setShowChat(false)}
        />
      )}

      {showSummary && (
        <div className="summary-overlay" role="dialog" aria-modal="true">
          <div className="summary-panel">
            <div className="summary-header">
              <h3>Meeting Summary</h3>
              <button type="button" onClick={() => setShowSummary(false)} aria-label="Close summary">✕</button>
            </div>
            <div className="summary-body">
              {summaryError && <div className="summary-error">{summaryError}</div>}
              {summaryLoading && <div className="summary-loading">Loading summary...</div>}
              {!summaryLoading && !summary && !summaryError && (
                <div className="summary-empty">
                  <p>No summary available yet.</p>
                  <p>Generate a summary from the saved meeting transcript.</p>
                </div>
              )}
              {summary && (
                <div className="summary-content">
                  <div className="summary-section">
                    <h4>Overview</h4>
                    <p>{summary.summary?.overview || summary.overview || "N/A"}</p>
                  </div>
                  <div className="summary-section">
                    <h4>Key Discussion Points</h4>
                    <ul>
                      {(summary.summary?.keyPoints || summary.keyPoints || []).map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="summary-section">
                    <h4>Decisions</h4>
                    <ul>
                      {(summary.summary?.decisions || summary.decisions || []).length > 0 ? (
                        (summary.summary?.decisions || summary.decisions || []).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))
                      ) : (
                        <li>No decisions recorded.</li>
                      )}
                    </ul>
                  </div>
                  <div className="summary-section">
                    <h4>Action Items</h4>
                    <ul>
                      {(summary.summary?.actionItems || summary.actionItems || []).length > 0 ? (
                        (summary.summary?.actionItems || summary.actionItems || []).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))
                      ) : (
                        <li>No action items recorded.</li>
                      )}
                    </ul>
                  </div>
                  {summary.summary?.conclusions || summary.conclusions ? (
                    <div className="summary-section">
                      <h4>Conclusions</h4>
                      <p>{summary.summary?.conclusions || summary.conclusions}</p>
                    </div>
                  ) : null}
                  {summary.generatedAt && (
                    <div className="summary-meta">
                      Generated: {new Date(summary.generatedAt).toLocaleString()}
                      {summary.transcriptCount ? ` • ${summary.transcriptCount} exchanges` : ""}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="summary-footer">
              <button type="button" onClick={generateSummary} disabled={summaryGenerating || summaryLoading}>
                {summaryGenerating ? "Generating..." : "Generate Summary"}
              </button>
              <button type="button" onClick={fetchSummary} disabled={summaryLoading || summaryGenerating}>
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {announcement && (
        <div className="anchor-announcement-overlay">
          <div className="announcement-box">
            <div className="announcement-header">
              <span className="announcement-icon">🎤</span>
              <span className="announcement-speaker">{announcement.speakerName}</span>
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
            /* Explicit enable/schedule action should start the new
               session even if a previous session was stopped while the
               enabled flag remained set. */
            hasAutoStartedAnchoringRef.current = true;
            enableAnchoring(settings);
            startAnchoring();
            setShowScheduleModal(false);
          }}
          participants={rtcParticipants}
          currentLanguage={currentLanguage}
        />
      )}

      {showPopup && <Popup onClose={() => setShowPopup(false)} />}
    </div>
  );
}
