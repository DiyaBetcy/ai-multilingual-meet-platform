import { useEffect, useRef, useState } from "react";
import "./chatpanel.css";

export default function ChatPanel({ open, onClose, messages, onSend }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages]);

  if (!open) return null;

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
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
          {messages.length === 0 ? (
            <div className="cp-empty">No messages yet.</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="cp-msg">
                <div className="cp-meta">
                  <span className="cp-sender">{m.sender}</span>
                  <span className="cp-time">{m.time}</span>
                </div>
                <div className="cp-text">{m.text}</div>
              </div>
            ))
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
              if (e.key === "Enter") handleSend();
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
