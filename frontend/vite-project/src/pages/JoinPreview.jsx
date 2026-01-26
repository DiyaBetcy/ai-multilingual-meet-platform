import "./JoinPreview.css";

export default function JoinPreview() {
  return (
    <div className="jp-container">

      {/* TOP BAR */}
      <div className="jp-top-bar">
        <img
          src="/src/assets/logo.png"
          alt="Logo"
          className="jp-logo"
        />
      </div>

      {/* MAIN BODY */}
      <div className="jp-body">

        {/* 3 DOT MENU */}
        <div className="jp-dots">⋮</div>

        {/* VIDEO PREVIEW BOX */}
        
        <div className="jp-video-box">
          <div className="jp-controls">
            <div className="jp-icon">
              <img src="/src/assets/mic-off.png" alt="Mic off" />
            </div>
            <div className="jp-icon">
              <img src="/src/assets/cam-off.png" alt="Camera off" />
            </div>
          </div>
        </div>

        {/* JOIN BUTTON */}
        <button className="jp-join-btn">JOIN</button>

      </div>
    </div>
  );
}
