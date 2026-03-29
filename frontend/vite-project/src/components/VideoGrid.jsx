import { useRef, useEffect } from 'react';
import './VideoGrid.css';

const VideoGrid = ({ 
  participants, 
  userName, 
  setLocalVideoRef, 
  localStream,
  isMuted,
  isVideoOff,
  isScreenSharing,
  handRaised
}) => {
  const remoteVideoRefs = useRef({});
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    setLocalVideoRef(localVideoRef.current);
  }, [setLocalVideoRef]);

  // Get grid class based on participant count
  const getGridClass = (count) => {
    if (count === 1) return 'grid-1';
    if (count === 2) return 'grid-2';
    if (count <= 4) return 'grid-4';
    if (count <= 6) return 'grid-6';
    if (count <= 9) return 'grid-9';
    return 'grid-12';
  };

  // Separate current user from others
  const currentUser = participants.find(p => p.isYou);
  const otherParticipants = participants.filter(p => !p.isYou);
  const totalParticipants = participants.length;

  return (
    <div className={`video-grid ${getGridClass(totalParticipants)}`}>
      {/* Current User Video */}
      {currentUser && (
        <div className="video-container local-video">
          <video
            ref={localVideoRef}
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
        <div key={participant.id} className="video-container remote-video">
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
          <div className="video-info">
            <span className="participant-name">{participant.name || participant.userName}</span>
            <div className="participant-status">
              <span className={`status-icon ${participant.micOn ? 'on' : 'off'}`}>
                {participant.micOn ? '🎤' : '🔇'}
              </span>
              <span className={`status-icon ${participant.camOn ? 'on' : 'off'}`}>
                {participant.camOn ? '📹' : '📵'}
              </span>
              {participant.isScreenSharing && <span className="status-icon">🖥️</span>}
              {participant.handRaised && <span className="status-icon hand">✋</span>}
            </div>
          </div>
          {participant.isScreenSharing && <div className="screen-badge">Sharing Screen</div>}
        </div>
      ))}
    </div>
  );
};

export default VideoGrid;
