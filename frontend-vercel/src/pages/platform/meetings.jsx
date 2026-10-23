import React from "react";
import "./meetings.css";

const Meetings = () => {
  const meetings = [
    {
      id: 1,
      title: "AI Conference",
      date: "12 Feb 2026",
      time: "10:00 AM"
    },
    {
      id: 2,
      title: "Project Discussion",
      date: "14 Feb 2026",
      time: "2:30 PM"
    },
    {
      id: 3,
      title: "Team Standup",
      date: "16 Feb 2026",
      time: "9:00 AM"
    }
  ];

  return (
    <div className="meetings-container">
      <div className="meetings-header">
        <h2>My Meetings</h2>
        <button className="new-meeting-btn">+ New Meeting</button>
      </div>

      <div className="meetings-list">
        {meetings.map((meeting) => (
          <div key={meeting.id} className="meeting-card">
            <h3>{meeting.title}</h3>
            <p>{meeting.date} • {meeting.time}</p>
            <button className="join-btn">Join</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Meetings;
