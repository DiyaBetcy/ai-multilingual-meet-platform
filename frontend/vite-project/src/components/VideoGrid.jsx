import { useCallback, useRef, useEffect } from 'react';
import { attachStreamToVideo } from '../lib/media.js';
import './VideoGrid.css';

const VideoGrid = ({ 
  participants, 
  userName, 
  setLocalVideoRef, 
  localStream,
  isMuted,
  isVideoOff,
  isScreenSharing,
  handRaised,
  speakingUser
}) => {
  const remoteVideoRefs = useRef({});
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(localStream);

  localStreamRef.current = localStream;

  /* Attach the local stream whenever it changes. The local tile may
     mount after getUserMedia resolves, so this cannot rely on the
     stream effect running after the ref exists. */
  useEffect(() => {
    attachStreamToVideo(localVideoRef.current, localStream, { muted: true });
    if (localVideoRef.current) {
      setLocalVideoRef(localVideoRef.current);
    }
  }, [localStream, setLocalVideoRef]);

  /* Callback ref: runs every time the <video> actually mounts. This is
     the path that fixes the black local preview after media init. */
  const attachLocalVideo = useCallback(
    (element) => {
      localVideoRef.current = element;

      if (element) {
        attachStreamToVideo(element, localStreamRef.current, { muted: true });
      }

      setLocalVideoRef(element);
    },
    [setLocalVideoRef]
  );

  /* Attach remote tracks after React has rendered the video element.
     The old code assigned srcObject inside pc.ontrack by querying the DOM,
     which missed the element whenever ontrack arrived before the
     participant tile mounted. */
  useEffect(() => {
    participants.forEach((participant) => {
      if (participant.isYou || participant.isAnchor) return;

      const video = remoteVideoRefs.current[participant.id];
      if (!video || !participant.stream) return;

      if (video.srcObject !== participant.stream) {
        video.srcObject = participant.stream;
      }

      video.play().catch((error) => {
        console.warn(
          "Remote video/audio autoplay was blocked:",
          participant.id,
          error
        );
      });
    });
  }, [participants]);

  // Get grid class based on participant count
  const getGridClass = (count) => {
    if (count === 1) return 'grid-1';
    if (count === 2) return 'grid-2';
    if (count <= 4) return 'grid-4';
    if (count <= 6) return 'grid-6';
    if (count <= 9) return 'grid-9';
    return 'grid-12';
  };

  // Separate current user from others. Render the local tile even before
  // the signaling server returns the participant list so the preview is
  // never blank while waiting for the room state.
  const currentUser = participants.find(p => p.isYou) || {
    id: "local-self",
    isYou: true,
    name: userName,
  };
  const otherParticipants = participants.filter(p => !p.isYou);
  const totalParticipants = Math.max(participants.length, 1);

  return (
    <div className={`video-grid ${getGridClass(totalParticipants)}`}>
      {/* Current User Video */}
      {currentUser && (
        <div className="video-container local-video">
          <video
            ref={attachLocalVideo}
            autoPlay
            playsInline
            muted
            className="video-element"
          />
          <div className="video-info">
            <span className="participant-name">{userName} (You)</span>
            <div className="participant-status">
              <span className={`status-icon ${isMuted ? 'off' : 'on'}`}>
                {isMuted ? '🔇' : '🎤'}
              </span>
              <span className={`status-icon ${isVideoOff ? 'off' : 'on'}`}>
                {isVideoOff ? '📵' : '📹'}
              </span>
              {isScreenSharing && <span className="status-icon">🖥️</span>}
              {handRaised && <span className="status-icon hand">✋</span>}
            </div>
          </div>
          {isScreenSharing && <div className="screen-badge">Sharing Screen</div>}
        </div>
      )}

      {/* Other Participants */}
      {otherParticipants.map((participant) => (
        <div 
          key={participant.id} 
          className={`video-container remote-video ${participant.isAnchor ? 'anchor-participant' : ''}`}
        >
          {participant.isAnchor ? (
            // AI Anchor - Show avatar instead of video
            <div className="anchor-avatar">
              <div className="avatar-circle">
                <span className="avatar-emoji">{participant.avatar || '🎤'}</span>
              </div>
              <div className="anchor-status">
                <span className="pulse-ring"></span>
              </div>
            </div>
          ) : (
            // Regular participant - Show video
            <video
              ref={(el) => {
                if (el) {
                  remoteVideoRefs.current[participant.id] = el;
                }
              }}
              autoPlay
              playsInline
              className="video-element"
              id={`video-${participant.id}`}
            />
          )}
          <div className="video-info">
            <span className="participant-name">
              {participant.name || participant.userName}
              {participant.isAnchor && <span className="anchor-badge">AI</span>}
              {speakingUser === participant.id && <span className="speaking-badge">🔊 Speaking</span>}
            </span>
            <div className="participant-status">
              {participant.isAnchor ? (
                <span className={`status-icon ${participant.isSpeaking ? 'speaking' : 'on'}`}>
                  🎤
                </span>
              ) : (
                <>
                  <span className={`status-icon ${participant.micOn ? 'on' : 'off'} ${speakingUser === participant.id ? 'speaking' : ''}`}>
                    {participant.micOn ? '🎤' : '🔇'}
                  </span>
                  <span className={`status-icon ${participant.camOn ? 'on' : 'off'}`}>
                    {participant.camOn ? '📹' : '📵'}
                  </span>
                  {participant.isScreenSharing && <span className="status-icon">🖥️</span>}
                  {participant.handRaised && <span className="status-icon hand">✋</span>}
                </>
              )}
            </div>
          </div>
          {participant.isScreenSharing && <div className="screen-badge">Sharing Screen</div>}
        </div>
      ))}
    </div>
  );
};

export default VideoGrid;
