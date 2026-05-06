import React from 'react';
import './AnchoringControlPanel.css';

const AnchoringControlPanel = ({
  isCreator,
  isAnchoringEnabled,
  isActive,
  schedule,
  currentSpeaker,
  currentIndex,
  timeRemaining,
  timeFormatted,
  onEnableAnchoring,
  onStartAnchoring,
  onPauseAnchoring,
  onResumeAnchoring,
  onSkipSpeaker,
  onStopAnchoring,
  onResetAnchoring,
  onOpenSchedule
}) => {
  if (!isCreator) {
    // Non-creator view
    if (!isAnchoringEnabled) {
      return (
        <div className="anchoring-panel participant-view">
          <div className="anchoring-header">
            <h4>🎤 AI Anchoring</h4>
          </div>
          <p className="anchoring-disabled-text">
            AI Anchoring is available. The meeting creator can enable it to manage speaker schedules automatically.
          </p>
        </div>
      );
    }
    
    return (
      <div className="anchoring-panel participant-view">
        <div className="anchoring-header">
          <h4>🎤 AI Anchoring Active</h4>
        </div>
        
        {currentSpeaker && (
          <div className="current-speaker-info">
            <div className="speaker-badge">
              <span className="speaker-label">Current Speaker</span>
              <span className="speaker-name">{currentSpeaker.speakerName}</span>
            </div>
            <div className="time-remaining">
              <span className="time-label">Time Remaining</span>
              <span className={`time-value ${timeRemaining < 60 ? 'warning' : ''}`}>
                {timeFormatted}
              </span>
            </div>
          </div>
        )}
        
        <div className="schedule-preview">
          <h5>Schedule ({currentIndex + 1} of {schedule.length})</h5>
          <div className="schedule-list">
            {schedule.map((item, index) => (
              <div 
                key={index} 
                className={`schedule-item ${index === currentIndex ? 'active' : ''} ${index < currentIndex ? 'completed' : ''}`}
              >
                <span className="item-number">{index + 1}</span>
                <span className="item-name">{item.speakerName}</span>
                <span className="item-duration">{item.duration}m</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Creator view
  return (
    <div className="anchoring-panel creator-view">
      <div className="anchoring-header">
        <h4>🎤 AI Anchoring Control</h4>
      </div>
      
      {!isAnchoringEnabled ? (
        <div className="anchoring-setup">
          <p className="setup-description">
            Enable AI anchoring to automatically manage speakers, create scripts, and control timing.
          </p>
          <button className="btn-primary" onClick={onOpenSchedule}>
            Enable Anchoring & Set Schedule
          </button>
        </div>
      ) : (
        <>
          <div className="anchoring-status">
            <span className={`status-indicator ${isActive ? 'active' : 'paused'}`}>
              {isActive ? '🟢 Running' : '⏸️ Paused'}
            </span>
          </div>
          
          {currentSpeaker && (
            <div className="current-speaker-control">
              <div className="speaker-info">
                <span className="label">Current Speaker:</span>
                <span className="name">{currentSpeaker.speakerName}</span>
              </div>
              <div className="topic-info">
                <span className="label">Topic:</span>
                <span className="topic">{currentSpeaker.topic}</span>
              </div>
              <div className={`timer ${timeRemaining < 60 ? 'warning' : ''}`}>
                <span className="label">Time Remaining:</span>
                <span className="time">{timeFormatted}</span>
              </div>
            </div>
          )}
          
          <div className="anchoring-controls">
            {!isActive ? (
              <button className="btn-control btn-start" onClick={() => {
                console.log('Start button clicked');
                onStartAnchoring();
              }}>
                ▶️ Start Anchoring
              </button>
            ) : (
              <>
                <button className="btn-control btn-pause" onClick={onPauseAnchoring}>
                  ⏸️ Pause
                </button>
                <button className="btn-control btn-skip" onClick={onSkipSpeaker}>
                  ⏭️ Skip Speaker
                </button>
              </>
            )}
            <button className="btn-control btn-schedule" onClick={onOpenSchedule}>
              📋 Edit Schedule
            </button>
            <button className="btn-control btn-stop" onClick={onStopAnchoring}>
              ⏹️ Stop Anchoring
            </button>
            <button className="btn-control btn-reset" onClick={onResetAnchoring}>
              🔄 Reset
            </button>
          </div>
          
          <div className="schedule-progress">
            <h5>Progress ({currentIndex + 1} / {schedule.length})</h5>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${((currentIndex + 1) / schedule.length) * 100}%` }}
              ></div>
            </div>
            <div className="schedule-list compact">
              {schedule.map((item, index) => (
                <div 
                  key={index} 
                  className={`schedule-item ${index === currentIndex ? 'active' : ''} ${index < currentIndex ? 'completed' : ''}`}
                >
                  <span className="item-number">{index + 1}</span>
                  <span className="item-name">{item.speakerName}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnchoringControlPanel;
