import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Signup from "./pages/signup.jsx";
import Login from "./pages/login.jsx";
import Dashboard from "./pages/dashboard.jsx";
import MeetDash from "./pages/platform/meetdashboard.jsx"; 
import Start from "./pages/start.jsx";
import QAPanel from "./pages/platform/QAPanel.jsx";
import JoinPreview from "./pages/JoinPreview.jsx";
import Home from "./pages/platform/Home";
import Meetings from "./pages/platform/meetings";
import Profile from "./pages/platform/profile";
import Settings from "./pages/platform/settings";


ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
  <Routes>
    <Route path="/" element={<Signup />} />
    <Route path="/login" element={<Login />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/preview/:mode" element={<JoinPreview />} />
    <Route path="/meeting/:roomId" element={<MeetDash />} />
    <Route path="/start" element={<Start />} />
    <Route path="/qa" element={<QAPanel />} />
    <Route path="/meetings" element={<Meetings />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/settings" element={<Settings />} />
  </Routes>
</BrowserRouter>
);
