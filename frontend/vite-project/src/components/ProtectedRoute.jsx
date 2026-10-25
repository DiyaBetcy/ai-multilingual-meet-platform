import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { clearSession, verifySession } from "../lib/session.js";

/* ============================================================
   ProtectedRoute — session gate for authenticated routes.

   The earlier bypass (a hardcoded "test-token" written on every
   load and accepted here) is gone. A route now requires a real JWT
   issued by the backend:

   * no token / malformed token / expired token -> /login;
   * backend /me rejects the token              -> /login;
   * backend unreachable                        -> the locally
     unexpired JWT is kept, so offline navigation does not break.
   ============================================================ */

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let active = true;

    verifySession().then((result) => {
      if (!active) return;

      if (!result.valid) {
        clearSession();
        setStatus("denied");
        return;
      }

      setStatus("allowed");
    });

    return () => {
      active = false;
    };
  }, []);

  if (status === "denied") {
    return <Navigate to="/login" replace />;
  }

  if (status === "checking") {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          gap: "var(--sp-3)",
          color: "var(--text-2)",
          background: "var(--bg-app)",
          font: "inherit",
        }}
      >
        Checking session…
      </div>
    );
  }

  return children;
}
