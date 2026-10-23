import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [meetingId, setMeetingId] = useState("");

  /* ---------- CREATE MEETING ---------- */
  const handleCreateMeeting = () => {
    navigate("/preview/create");
  };

  /* ---------- JOIN MEETING ---------- */
  const handleJoinMeeting = () => {
    if (!meetingId.trim()) {
      alert("Please enter a Meeting ID");
      return;
    }

    navigate("/preview/join", {
      state: { meetingId },
    });
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>Dashboard</h1>

      <button onClick={handleCreateMeeting} style={{ margin: "10px" }}>
        Create Meeting
      </button>

      <div style={{ marginTop: "20px" }}>
        <input
          type="text"
          placeholder="Enter Meeting ID"
          value={meetingId}
          onChange={(e) => setMeetingId(e.target.value)}
        />
        <button onClick={handleJoinMeeting} style={{ marginLeft: "10px" }}>
          Join Meeting
        </button>
      </div>
    </div>
  );
}