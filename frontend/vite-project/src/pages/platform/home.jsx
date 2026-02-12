import { useNavigate } from "react-router-dom";
import "./home.css";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="base-container">
      
      {/* Top Bar */}
      <div className="start-top-bar">
        <h2 className="logo-text">Meet</h2>
        <div className="start-menu">
          <span onClick={() => navigate("/home")}>Home</span>
          <span onClick={() => navigate("/meetings")}>Meetings</span>
          <span onClick={() => navigate("/settings")}>Settings</span>
          <span onClick={() => navigate("/profile")}>Profile</span>
        </div>
      </div>

      {/* Home Content */}
      <div className="home-content">
        <div className="home-card">
          <h1>Welcome Back 👋</h1>

          <button
            className="primary-btn"
            onClick={() => navigate("/start")}
          >
            Start New Meeting
          </button>

          <button className="secondary-btn">
            Join Meeting
          </button>

          <div className="recent-section">
            <h3>Recent Meetings</h3>
            <ul>
              <li>Project Discussion</li>
              <li>Placement Prep Call</li>
              <li>Team Sync</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
