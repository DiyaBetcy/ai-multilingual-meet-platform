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
             <button className="google-btn">Sign up with Google</button>
             <p className="or-text">— or —</p>
            <form>
              <input type="text" placeholder="Full Name" />
              <input type="email" placeholder="Email" />
              <p className="send-otp">
              <a href="/send-otp">Send OTP</a>
              </p>
              <input type="password" placeholder="Password" />
              <input type="password" placeholder="Confirm Password" />
              <button className="submit" type="submit">Sign Up</button>
            </form>
            <p className="already-account">
            Already have an account? <a href="/login">Login</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
