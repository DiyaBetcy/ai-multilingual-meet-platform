import "./meetdashboard.css";

export default function MeetDash() {
  return (
    <div className="base-container">
      {/* Top Bar */}
      <div className="top-bar">
        <img src="/src/assets/logo.png" alt="Logo" className="logo-image" />
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Big video */}
        <div className="main-video"></div>

        {/* Small videos grid */}
        <div className="side-videos">
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
          <div className="video-tile"></div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="controls">
        <button className="control-btn">
          <img src="/src/assets/mic.png" alt="Mic" />
        </button>
        <button className="control-btn">
          <img src="/src/assets/camera.png" alt="Camera" />
        </button>
        <button className="control-btn">
          <img src="/src/assets/cc.png" alt="Captions" />
        </button>
        <button className="control-btn">
          <img src="/src/assets/hand.png" alt="Raise Hand" />
        </button>
        <button className="control-btn">
          <img src="/src/assets/share.png" alt="Share" />
        </button>
        <button className="control-btn">
          <img src="/src/assets/more.png" alt="More" />
        </button>
        <button className="control-btn end">
          <img src="/src/assets/hangup.png" alt="Hang Up" />
        </button>
      </div>
    </div>
  );
}
