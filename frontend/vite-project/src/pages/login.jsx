import "./login.css";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();   // prevent page refresh
    navigate("/start");  // go to Start page
  };

  return (
    <div className="signup-container">

      {/* Top Bar */}
      <div className="top-bar">
        <img src="/src/assets/logo.png" alt="Logo" className="logo-image" />

        <div className="nav-menu">
          <span onClick={() => navigate("/")}>Home</span>
          <span onClick={() => navigate("/meetings")}>Meetings</span>
          <span onClick={() => navigate("/settings")}>Settings</span>
          <span onClick={() => navigate("/profile")}>Profile</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">

        {/* LEFT SIDE */}
        <div className="left-panel">
          <h1 className="brand-text">Meet</h1>
        </div>

        {/* RIGHT SIDE */}
        <div className="right-panel">
          <div className="form-wrapper">

            <h2>Log in</h2>

            <form onSubmit={handleLogin}>
              <input type="text" placeholder="Username or Email" />
              <input type="password" placeholder="Password" />

              <button className="submit" type="submit">
                Login
              </button>
            </form>

            <p className="already-account">
              Don’t have an account?{" "}
              <span
                style={{ color: "#19E5D8", cursor: "pointer" }}
                onClick={() => navigate("/")}
              >
                Create an account
              </span>
            </p>

          </div>
        </div>

      </div>
    </div>
  );
}
