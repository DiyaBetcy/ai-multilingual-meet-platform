import "./participantsPanel.css";

export default function ParticipantsPanel({ open, onClose, participants = [] }) {
  if (!open) return null;

  const safeParticipants = Array.isArray(participants) ? participants : [];
  const raisedCount = safeParticipants.filter((p) => p.handRaised).length;

  return (
    <div className="pp-overlay" onClick={onClose}>
      <div className="pp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pp-header">
          <div>
            <div className="pp-title">People</div>
            <div className="pp-subtitle">
              Participants ({safeParticipants.length}) • Raised hands ({raisedCount})
            </div>
          </div>

          <button className="pp-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="pp-list">
          {safeParticipants.length === 0 ? (
            <div
              style={{
                padding: "20px",
                color: "#aaa",
                textAlign: "center",
              }}
            >
              No participants yet
            </div>
          ) : (
            safeParticipants.map((p, index) => {
              const displayName = p?.name || "Guest";
              const avatarLetter = displayName[0]?.toUpperCase() || "?";
              const key = p.socketId || p.id || `${displayName}-${index}`;
              const isYou = Boolean(p.isYou);
              const isHost = Boolean(p.isHost);
              const micOn = Boolean(p.micOn);
              const camOn = Boolean(p.camOn);
              const handRaised = Boolean(p.handRaised);
              const isSharing = Boolean(p.isSharing);

              return (
                <div className="pp-row" key={key}>
                  <div className="pp-avatar">{avatarLetter}</div>

                  <div className="pp-info">
                    <div className="pp-name">
                      {displayName}{" "}
                      {isYou ? <span className="pp-you">(You)</span> : null}
                      {isHost ? <span className="pp-you"> (Host)</span> : null}
                      {handRaised ? (
                        <span className="pp-hand-inline"> ✋</span>
                      ) : null}
                    </div>

                    <div className="pp-status">
                      <span style={{ color: micOn ? "#4caf50" : "red" }}>
                        {micOn ? "🎤 On" : "🎤 Muted"}
                      </span>
                      {" • "}
                      <span style={{ color: camOn ? "#4caf50" : "#aaa" }}>
                        {camOn ? "📷 On" : "📷 Off"}
                      </span>
                      {isSharing ? (
                        <>
                          {" • "}
                          <span style={{ color: "#4caf50" }}>🖥️ Sharing</span>
                        </>
                      ) : null}
                    </div>

                    {p?.preferredLanguage ? (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#9aa0a6",
                          marginTop: "4px",
                        }}
                      >
                        Language: {p.preferredLanguage}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}