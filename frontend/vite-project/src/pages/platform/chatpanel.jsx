import { useEffect, useRef, useState } from "react";
import "./chatpanel.css";

export default function ChatPanel({ messages, onSendMessage, onClose }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    onSendMessage(t);
    setText("");
  };

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cp-header">
          <div className="cp-title">Chat</div>
          <button
            type="button"
            className="cp-close"
            onClick={onClose}
            aria-label="Close chat"
            title="Close chat"
          >
            ✕
          </button>
        </div>

        <div className="cp-messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="cp-empty">No messages yet.</div>
          ) : (
            messages.map((m, index) => (
              <div
                key={`${m.userId || "user"}-${m.id || index}`}
                className="cp-msg"
              >
                <div className="cp-meta">
                  <span className="cp-sender">
                    {m.userName || m.sender || "Participant"}
                  </span>
                  <span className="cp-time">
                    {m.timestamp
                      ? new Date(m.timestamp).toLocaleTimeString()
                      : ""}
                  </span>
                </div>
                <div className="cp-text">{m.message ?? m.text ?? ""}</div>
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
            aria-label="Chat message"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            type="button"
            className="cp-send"
            onClick={handleSend}
            disabled={!text.trim()}
            aria-label="Send chat message"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
