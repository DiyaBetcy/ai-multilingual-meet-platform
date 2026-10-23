/* ------------------------------------------------------------
   Design system layers.
   Imported first so the cascade order is preserved in the bundle:
     tokens      -> design tokens (dark default + light theme)
     base        -> reset + element defaults
     primitives  -> shared UI primitives
   Every page/component stylesheet imported below still overrides
   them by cascade.
   ------------------------------------------------------------ */
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/primitives.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import BootShell from "./components/BootShell.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Signup from "./pages/signup.jsx";
import Login from "./pages/login.jsx";
import Dashboard from "./pages/dashboard.jsx";
import MeetDash from "./pages/platform/meetdashboard.jsx"; 
import Start from "./pages/start.jsx";
import QAPanel from "./pages/platform/QAPanel.jsx";
import JoinPreview from "./pages/JoinPreview.jsx";
import Meetings from "./pages/platform/meetings.jsx";
import Profile from "./pages/platform/profile.jsx";
import Settings from "./pages/platform/settings.jsx";

import { Navigate } from "react-router-dom";

/* ------------------------------------------------------------
   Authentication.

   Protected routes read the session written by the login flow via
   src/components/ProtectedRoute.jsx. The old development bypass
   (an unconditional "test-token" written here on every page load)
   has been removed: it authenticated every visitor and made every
   protected route public.
   ------------------------------------------------------------ */

/* ------------------------------------------------------------
   Boot shell.

   index.html ships a static copy of the preloader so the screen is
   already on the page while this bundle is still downloading.
   BootShell owns the handover and retires the preloader as soon as
   the first route has rendered — see src/components/BootShell.jsx.
   ------------------------------------------------------------ */

ReactDOM.createRoot(document.getElementById("root")).render(
  <BootShell>
    <BrowserRouter>
      <Routes>

        {/* Default route */}
        <Route
          path="/"
          element={<Navigate to="/start" replace />}
        />

        {/* Auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected routes */}
        <Route
          path="/start"
          element={
            <ProtectedRoute>
              <Start />
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

        {/* A URL without an id (also covers "/meeting/") renders the
            meeting screen's "Meeting ID missing" state instead of a blank page. */}
        <Route
          path="/meeting"
          element={
            <ProtectedRoute>
              <MeetDash />
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
  </BootShell>
);
