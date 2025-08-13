import "./signup.css";

export default function Signup() {
  return (
    <div className="signup-container">
      <div className="top-bar">
        <img src="/src/assets/logo.png" alt="Logo" className="logo-image" />
      </div>

      <div className="main-content">
        <div className="left-panel">
          <h1 className="brand-text">Meet</h1>
        </div>

        {/* Right side */}
        <div className="right-panel">
          <div className="form-wrapper">
            <h2>Create Account</h2>
            <form>
              <input type="text" placeholder="Full Name" />
              <input type="email" placeholder="Email" />
              <input type="password" placeholder="Password" />
              <button type="submit">Sign Up</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
