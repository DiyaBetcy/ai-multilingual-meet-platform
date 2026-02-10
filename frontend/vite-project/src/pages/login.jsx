import "./login.css";   // ✅ make sure name matches your file
import { useNavigate } from "react-router-dom";

export default function login() {
  return (
    <div className="base-container">
      
<div className="start-top-bar">
        <img src="/src/assets/logo.png" className="start-logo" />
        <div className="start-menu">
          <span>Home</span>
          <span>Meetings</span>
          <span>Settings</span>
          <span>Profile</span>
        </div>
      </div>

      <div className="main-content">
        <div className="left-section">
          <h1 className="app-title">Meet</h1>
        </div>

        <div className="right-section">
          <h2 className="login-title">Log in</h2>
          <form className="login-form">
            <label htmlFor="username">Username or Email</label>
            <input type="text" id="username" />

            <label htmlFor="password">Password</label>
            <input type="password" id="password" />

            <button type="submit" className="login-btn">Login</button>
          </form>
          <p className="signup-text">
            Don’t have an account? <a href="#">Create an account</a>
          </p>
        </div>
      </div>
    </div>
  );
}
