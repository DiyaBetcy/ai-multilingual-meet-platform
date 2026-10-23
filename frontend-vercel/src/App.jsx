import { Routes, Route } from "react-router-dom";
import JoinPreview from "./pages/JoinPreview.jsx";
import MeetDashboard from "./pages/platform/meetdashboard.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<h1>Home Page</h1>} />
      <Route path="/preview/:mode" element={<JoinPreview />} />
      <Route path="/meeting/:meetingId" element={<MeetDashboard />} />
    </Routes>
  );
}