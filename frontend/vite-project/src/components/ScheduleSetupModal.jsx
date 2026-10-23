import React, { useState } from 'react';
import './ScheduleSetupModal.css';

const ScheduleSetupModal = ({ onClose, onSave, participants, currentLanguage }) => {
  const [meetingTitle, setMeetingTitle] = useState('');
  const [scheduleItems, setScheduleItems] = useState([
    { speakerName: '', topic: '', duration: 5, userId: '' }
  ]);
  const [anchorLanguage, setAnchorLanguage] = useState(currentLanguage || 'en-US');

  const languages = [
    { code: 'en-US', name: 'English' },
    { code: 'hi-IN', name: 'Hindi' },
    { code: 'ml-IN', name: 'Malayalam' },
    { code: 'ta-IN', name: 'Tamil' }
  ];

  const addScheduleItem = () => {
    setScheduleItems([...scheduleItems, { speakerName: '', topic: '', duration: 5, userId: '' }]);
  };

  const removeScheduleItem = (index) => {
    if (scheduleItems.length > 1) {
      setScheduleItems(scheduleItems.filter((_, i) => i !== index));
    }
  };

  const updateScheduleItem = (index, field, value) => {
    const updated = [...scheduleItems];
    updated[index][field] = value;
    setScheduleItems(updated);
  };

  const handleParticipantSelect = (index, participant) => {
    const updated = [...scheduleItems];
    updated[index].speakerName = participant.name;
    updated[index].userId = participant.id;
    setScheduleItems(updated);
  };

  const handleSave = () => {
    // Filter out empty items
    const validSchedule = scheduleItems.filter(item => item.speakerName.trim() !== '');
    
    if (validSchedule.length === 0) {
      alert('Please add at least one speaker to the schedule');
      return;
    }

    onSave({
      meetingTitle: meetingTitle || 'Meeting',
      schedule: validSchedule,
      language: anchorLanguage
    });
  };

  const totalDuration = scheduleItems.reduce((sum, item) => sum + (parseInt(item.duration) || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎤 AI Anchoring Setup</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="form-group">
            <label>Meeting Title</label>
            <input
              type="text"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="Enter meeting title"
            />
          </div>

          <div className="form-group">
            <label>Anchor Language</label>
            <select value={anchorLanguage} onChange={(e) => setAnchorLanguage(e.target.value)}>
              {languages.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>

          <div className="schedule-section">
            <div className="section-header">
              <h3>Speaker Schedule</h3>
              <span className="total-time">Total: {totalDuration} min</span>
            </div>

            <div className="schedule-list">
              {scheduleItems.map((item, index) => (
                <div key={index} className="schedule-item-form">
                  <div className="item-number">{index + 1}</div>
                  
                  <div className="item-fields">
                    <div className="field-row">
                      <select
                        value={item.userId}
                        onChange={(e) => {
                          const participant = participants.find(p => p.id === e.target.value);
                          if (participant) {
                            handleParticipantSelect(index, participant);
                          }
                        }}
                        className="participant-select"
                      >
                        <option value="">Select participant...</option>
                        {participants.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      
                      <input
                        type="text"
                        placeholder="Or enter name manually"
                        value={item.speakerName}
                        onChange={(e) => updateScheduleItem(index, 'speakerName', e.target.value)}
                        className="name-input"
                      />
                    </div>

                    <div className="field-row">
                      <input
                        type="text"
                        placeholder="Topic / Title"
                        value={item.topic}
                        onChange={(e) => updateScheduleItem(index, 'topic', e.target.value)}
                        className="topic-input"
                      />
                      
                      <div className="duration-field">
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={item.duration}
                          onChange={(e) => updateScheduleItem(index, 'duration', parseInt(e.target.value) || 5)}
                          className="duration-input"
                        />
                        <span>min</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    className="remove-btn"
                    onClick={() => removeScheduleItem(index)}
                    disabled={scheduleItems.length === 1}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>

            <button className="add-btn" onClick={addScheduleItem}>
              + Add Speaker
            </button>
          </div>

          <div className="info-box">
            <h4>How AI Anchoring Works:</h4>
            <ul>
              <li>🎤 AI anchor introduces each speaker automatically</li>
              <li>⏱️ Timer tracks each speaker's allocated time</li>
              <li>🔔 1-minute and 30-second warnings announced</li>
              <li>🔇 Auto-mutes speaker when time is up</li>
              <li>🗣️ Smooth transitions between speakers</li>
              <li>🌐 AI speaks in selected language</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>
            Enable Anchoring
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleSetupModal;
