import React from "react";
import "./profile.css";

const Profile = () => {
  return (
    <div className="profile-container">

      <div className="profile-card">
        <div className="profile-avatar">
          <div className="avatar-circle">LB</div>
        </div>

        <div className="profile-details">
          <h2>Lakshmi B</h2>
          <p className="email">lakshmi@email.com</p>

          <div className="profile-info">
            <div className="info-box">
              <span>Total Meetings</span>
              <strong>24</strong>
            </div>

            <div className="info-box">
              <span>Hosted</span>
              <strong>10</strong>
            </div>

            <div className="info-box">
              <span>Joined</span>
              <strong>14</strong>
            </div>
          </div>

          <button className="edit-btn">Edit Profile</button>
        </div>
      </div>

    </div>
  );
};

export default Profile;
