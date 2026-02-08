import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./start.css";

export default function Start() {
  const [mode, setMode] = useState(null); 
  const navigate = useNavigate();
  
  return (
    <div className="start-page">
     
      <div className="start-top-bar">
        <img src="/src/assets/logo.png" className="start-logo" />
        <div className="start-menu">
          <span>Home</span>
          <span>Meetings</span>
          <span>Settings</span>
          <span>Profile</span>
        </div>
      </div>

     
      <div className="start-main">
        <div className="start-buttons">
          <button onClick={() => navigate("/preview/create")} className="start-btn">
  Create Meeting
</button>

      

          <button onClick={() => navigate("/preview/join")}className="start-btn">
  Join Meeting
</button>
          
        </div>

        {mode && (
          <div className="start-meeting-bar">
            <input placeholder={mode === "create" ? "Meeting ID" : "Enter Code"} />
            <input placeholder="Your Name" />

            <div className="start-options">
              <label><input type="checkbox" /> Video Off</label>
              <label><input type="checkbox" /> Mic Off</label>
            </div>

            <button className="start-action-btn">
              {mode === "create" ? "Start" : "Join"}
            </button>
          </div>
        )}
      </div>

      
    
    </div>
  );
}
