import "./participantsPanel.css";

export default function ParticipantsPanel({ open, onClose, participants }) {
  if (!open) return null;

  const raisedCount = participants.filter((p) => p.handRaised).length;

  return (
    <div className="pp-overlay" onClick={onClose}>
      <div className="pp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pp-header">
          <div>
            <div className="pp-title">People</div>
            <div className="pp-subtitle">
              Participants ({participants.length}) • Raised hands ({raisedCount})
            </div>
          </div>

          <button className="pp-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="pp-list">
          {participants.map((p) => (
            <div className="pp-row" key={p.id}>
              <div className="pp-avatar">{p.name[0]?.toUpperCase()}</div>

              <div className="pp-info">
                <div className="pp-name">
                  {p.name} {p.isYou ? <span className="pp-you">(You)</span> : null}
                </div>
                <div className="pp-status">
                  {p.micOn ? "🎤 On" : "🎤 Off"} • {p.camOn ? "📷 On" : "📷 Off"}
                </div>
              </div>

              {p.handRaised ? <div className="pp-hand">✋</div> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
