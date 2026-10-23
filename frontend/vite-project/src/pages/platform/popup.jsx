import { useEffect, useRef } from "react";
import "./popup.css";
import { useNavigate } from "react-router-dom";

export default function Popup({ open, onClose }) {
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  /* Keep the latest onClose without re-running the effect (and
     re-focusing the dialog) on every parent render. */
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onCloseRef.current?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open) return null;

  const openQA = () => {
    onClose();
    navigate("/qa");
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-card"
        id="meet-more-popup"
        role="dialog"
        aria-modal="true"
        aria-label="More options"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="popup-title">More Options</h3>

        {/* Q&A */}
        <div
          className="popup-option"
          role="button"
          tabIndex={0}
          onClick={openQA}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openQA();
            }
          }}
        >
          <span>💬</span>
          <p>Q&A Panel (Moderated)</p>
        </div>

        {/* Emoji reactions */}
        <div className="popup-option emoji-row">
          <p>Emoji Reactions</p>
          <div className="emojis">
            <span>👏</span>
            <span>👍</span>
            <span>❤️</span>
            <span>😂</span>
            <span>😮</span>
            <span>😢</span>
            <span>❓</span>
            <span>🔥</span>
            <span>🌍</span>
          </div>
        </div>

        <button className="close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
