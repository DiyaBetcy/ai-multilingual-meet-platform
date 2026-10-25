/* ------------------------------------------------------------
   BootShell — app-level boot lifecycle.

   index.html ships a static copy of the preloader so the loading
   screen is already on the page while the JavaScript bundle is
   still downloading. This shell owns the handover:

     1. layout effect — the static copy is removed before React's
        first paint, so there is never more than one preloader on
        screen at the same time;
     2. effect — the preloader stays up until the first route has
        rendered AND at least MIN_VISIBLE_MS has elapsed since the
        static boot screen first painted.

   The minimum is measured from a timestamp written by index.html,
   not from React's mount, so a fast app still shows the screen for
   the full duration. If mounting takes longer than the minimum,
   nothing is added: the screen only waits for the remaining time.

   Only one timer is created, and it is cleared on unmount. Nothing
   here touches routing, authentication or any meeting feature.
   ------------------------------------------------------------ */
import { useEffect, useLayoutEffect, useState } from "react";
import Preloader from "./Preloader.jsx";

const MIN_VISIBLE_MS = 2500;

function bootStartedAt() {
  if (typeof window !== "undefined" && Number.isFinite(window.__appBootAt)) {
    return window.__appBootAt;
  }
  // Fallback for a document without the inline boot clock.
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function now() {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export default function BootShell({ children }) {
  const [booting, setBooting] = useState(true);

  useLayoutEffect(() => {
    const shell = document.getElementById("app-boot");
    if (shell && shell.parentNode) {
      shell.parentNode.removeChild(shell);
    }
  }, []);

  useEffect(() => {
    const elapsed = Math.max(0, now() - bootStartedAt());
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    if (remaining === 0) {
      setBooting(false);
      return undefined;
    }

    const timer = setTimeout(() => setBooting(false), remaining);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {children}
      <Preloader visible={booting} />
    </>
  );
}
