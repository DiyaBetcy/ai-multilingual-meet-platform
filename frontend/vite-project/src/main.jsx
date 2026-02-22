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

import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
  <Routes>

  {/* Default route */}
  <Route
    path="/"
    element={
      localStorage.getItem("token")
        ? <Navigate to="/dashboard" replace />
        : <Navigate to="/login" replace />
    }
  />

  {/* Auth routes */}
  <Route path="/login" element={<Login />} />
  <Route path="/signup" element={<Signup />} />

  {/* Protected routes */}
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    }
  />

  <Route
    path="/preview/:mode"
    element={
      <ProtectedRoute>
        <JoinPreview />
      </ProtectedRoute>
    }
  />

  <Route
    path="/meeting/:roomId"
    element={
      <ProtectedRoute>
        <MeetDash />
      </ProtectedRoute>
    }
  />

  <Route
    path="/start"
    element={
      <ProtectedRoute>
        <Start />
      </ProtectedRoute>
    }
  />

  <Route
    path="/qa"
    element={
      <ProtectedRoute>
        <QAPanel />
      </ProtectedRoute>
    }
  />

  <Route
    path="/meetings"
    element={
      <ProtectedRoute>
        <Meetings />
      </ProtectedRoute>
    }
  />

  <Route
    path="/profile"
    element={
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    }
  />

  <Route
    path="/settings"
    element={
      <ProtectedRoute>
        <Settings />
      </ProtectedRoute>
    }
  />

</Routes>
</BrowserRouter>
);
