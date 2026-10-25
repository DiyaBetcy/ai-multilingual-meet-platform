import "./WaitingRoomPanel.css";

export default function WaitingRoomPanel({
  participants,
  onAdmit,
  onReject,
}) {
  return (
    <section className="wr-panel" aria-label="Waiting room">
      <div className="wr-header">
        <div>
          <h3 className="wr-title">Waiting room</h3>
          <p className="wr-subtitle">
            {participants.length === 1
              ? "1 person is waiting"
              : `${participants.length} people are waiting`}
          </p>
        </div>
      </div>

      <ul className="wr-list">
        {participants.map((participant) => (
          <li className="wr-row" key={participant.id}>
            <div className="wr-avatar" aria-hidden="true">
              {(participant.name || "?").charAt(0).toUpperCase()}
            </div>

            <div className="wr-info">
              <span className="wr-name">
                {participant.name || "Participant"}
              </span>

              <div className="wr-actions">
                <button
                  type="button"
                  className="wr-admit"
                  onClick={() => onAdmit(participant.id)}
                  aria-label={`Admit ${participant.name || "participant"}`}
                >
                  Admit
                </button>
                <button
                  type="button"
                  className="wr-reject"
                  onClick={() => onReject(participant.id)}
                  aria-label={`Reject ${participant.name || "participant"}`}
                >
                  Reject
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
