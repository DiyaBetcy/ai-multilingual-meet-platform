import "./login.css";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();

    // Temporary login logic
    localStorage.setItem("token", "demoUser");
    navigate("/dashboard");
  };

  return (
  <div className="auth-page">

    {/* Top Navbar */}
    <div className="auth-navbar">
      <img src="/src/assets/logo.png" alt="Logo" />
    </div>

    <div className="auth-content">

      {/* Left Side */}
      <div className="auth-left">
        <h1>Meet</h1>
      </div>

      {/* Right Side Login Card */}
      <div className="auth-right">
        <div className="auth-card">

          <h2>Sign In</h2>

          <form onSubmit={handleLogin}>
            <input type="text" placeholder="Username or Email" required />
            <input type="password" placeholder="Password" required />

            <button type="submit">Login</button>
          </form>

          <p>
            Don’t have an account?{" "}
            <span onClick={() => navigate("/signup")}>
              Create an account
            </span>
          </p>

        </div>
      </div>

    </div>
  </div>
);
}