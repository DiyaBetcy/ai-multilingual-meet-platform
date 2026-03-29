import "./participantsPanel.css";

export default function ParticipantsPanel({ participants, onClose }) {
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
  {p.handRaised && <span className="pp-hand-inline"> ✋</span>}
</div>

                <div className="pp-status">
  <span style={{ color: p.micOn ? "#4caf50" : "red" }}>
    {p.micOn ? "🎤 On" : "🎤 Muted"}
  </span>
  {" • "}
  <span style={{ color: p.camOn ? "#4caf50" : "#aaa" }}>
    {p.camOn ? "📷 On" : "📷 Off"}
  </span>
</div>

              </div>

              
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
