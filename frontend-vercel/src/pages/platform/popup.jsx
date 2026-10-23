import "./popup.css";
import { useNavigate } from "react-router-dom";

export default function Popup({ open, onClose }) {
  const navigate = useNavigate();

  if (!open) return null;

  const openQA = () => {
    onClose();
    navigate("/qa");
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="popup-title">More Options</h3>

        {/* Q&A */}
        <div className="popup-option" onClick={openQA}>
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
