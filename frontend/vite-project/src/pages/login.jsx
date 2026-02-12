import "./login.css";

export default function Login() {
  return (
    <div className="signup-container">

      {/* Top Bar */}
      <div className="top-bar">
  <img src="/src/assets/logo.png" alt="Logo" className="logo-image" />

  <div className="nav-menu">
    <a href="/">Home</a>
    <a href="/meetings">Meetings</a>
    <a href="/settings">Settings</a>
    <a href="/profile">Profile</a>
  </div>
</div>


      {/* Main Content */}
      <div className="main-content">

        {/* LEFT SIDE (MEET TEXT) */}
        <div className="left-panel">
          <h1 className="brand-text">Meet</h1>
        </div>

        {/* RIGHT SIDE (LOGIN CARD) */}
        <div className="right-panel">
          <div className="form-wrapper">

            <h2>Log in</h2>

            <form>
              <input type="text" placeholder="Username or Email" />
              <input type="password" placeholder="Password" />

              <button className="submit" type="submit">
                Login
              </button>
            </form>

            <p className="already-account">
              Don’t have an account? <a href="#">Create an account</a>
            </p>

          </div>
        </div>

      </div>
    </div>
  );
}
