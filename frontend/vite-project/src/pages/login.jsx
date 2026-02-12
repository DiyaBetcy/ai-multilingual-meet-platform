import "./login.css";   // ✅ make sure name matches your file
import { useNavigate } from "react-router-dom";
import { useState } from "react";
export default function login() {
    const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    // 🔐 TEMPORARY HARDCODED CREDENTIALS
    const validUsername = "admin";
    const validPassword = "1234";

    if (!username || !password) {
      setError("Please enter username and password");
      return;
    }

    if (username === validUsername && password === validPassword) {
      // ✅ LOGIN SUCCESS
      setError("");
      navigate("/start");
    } else {
      // ❌ LOGIN FAILED
      setError("Invalid username or password");
    }
  };
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
          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="username">Username or Email</label>
            <input type="text" value={username}
              onChange={(e) => setUsername(e.target.value)}/>

            <label htmlFor="password">Password</label>
            <input type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}/>
 {error && <p style={{ color: "red", fontSize: "12px" }}>{error}</p>}
            <button type="submit" className="login-btn">Login</button>
          </form>
        
            
          
          {/* ✅ WORKING CREATE ACCOUNT LINK */}
          <p className="signup-text">
            Don’t have an account? {" "} 
            <span
              className="signup-link"
              onClick={() => navigate("/")}
            >
              <a href="#">Create an account</a>
            </span>
          </p>

        </div>
      </div>
    </div>
  );
}
