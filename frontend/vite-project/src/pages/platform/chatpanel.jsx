import { useEffect, useRef, useState } from "react";
import "./chatpanel.css";

export default function ChatPanel({
  open,
  onClose,
  messages = [],
  onSend,
}) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  const safeMessages = Array.isArray(messages) ? messages : [];

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, safeMessages]);

  if (!open) return null;

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (typeof onSend === "function") {
      onSend(trimmed);
    }

    setText("");
  };

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cp-header">
          <div className="cp-title">Chat</div>
          <button className="cp-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="cp-messages">
          {safeMessages.length === 0 ? (
            <div className="cp-empty">No messages yet.</div>
          ) : (
            safeMessages.map((m, index) => {
              const key = m?.id || `${m?.sender || "msg"}-${index}`;
              const sender = m?.sender || "Unknown";
              const time = m?.time || "";
              const textValue = m?.text || "";

              return (
                <div key={key} className="cp-msg">
                  <div className="cp-meta">
                    <span className="cp-sender">{sender}</span>
                    <span className="cp-time">{time}</span>
                  </div>
                  <div className="cp-text">{textValue}</div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="cp-inputRow">
          <input
            className="cp-input"
            value={text}
            placeholder="Send a message to everyone"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSend();
              }
            }}
          />
          <button className="cp-send" onClick={handleSend}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}