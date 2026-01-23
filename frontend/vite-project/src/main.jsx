import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Signup from "./pages/signup.jsx";
import Login from "./pages/login.jsx";
import Dashboard from "./pages/dashboard.jsx";
import MeetDash from "./pages/platform/meetdashboard.jsx"; 
import Start from "./pages/start.jsx";
import QAPanel from "./pages/platform/QAPanel.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/meetdash" element={<MeetDash />}/>
      <Route path ="/start"  element ={<Start />} />
      <Route path="/qa" element={<QAPanel />} />

    </Routes>
  </BrowserRouter>
);
