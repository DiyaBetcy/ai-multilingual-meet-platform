/* ------------------------------------------------------------
   Preloader — full-viewport loading screen.

   Used by the app boot sequence (see src/main.jsx) and reusable
   anywhere a full-surface loading state is needed.

   Contract
     * The progress indicator is INDETERMINATE on purpose: the
       application has no real progress signal to report, so no
       percentage is ever rendered.
     * Colours come from the design tokens, so the screen re-skins
       itself with the active theme.
     * Every animation is switched off under prefers-reduced-motion.

   Markup note: index.html ships an identical static copy of this
   screen so it can paint before the JS bundle arrives. If the
   markup changes here, change it there too.
   ------------------------------------------------------------ */
import { useEffect, useRef, useState } from "react";
import logoImg from "../assets/logo.png";
import "./Preloader.css";

// Must stay >= the CSS fade duration so the node is never yanked
// mid-transition.
const EXIT_MS = 420;

export default function Preloader({
  visible = true,
  status = "Preparing your workspace",
  tagline = "Real-time translation in every language.",
  onHidden,
}) {
  const [leaving, setLeaving] = useState(!visible);
  const [mounted, setMounted] = useState(true);
  const onHiddenRef = useRef(onHidden);

  useEffect(() => {
    onHiddenRef.current = onHidden;
  }, [onHidden]);

  // The caller asked for the screen to go away.
  useEffect(() => {
    if (!visible) setLeaving(true);
  }, [visible]);

  // Retire the node once the exit animation has had its time.
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(() => {
      setMounted(false);
      if (onHiddenRef.current) onHiddenRef.current();
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  if (!mounted) return null;

  return (
    <div
      className="preloader"
      data-state={leaving ? "leaving" : "active"}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="preloader__inner">
        <span className="preloader__halo" aria-hidden="true" />

        <span className="preloader__mark" aria-hidden="true">
          <img className="preloader__logo" src={logoImg} alt="" />
        </span>

        <div className="preloader__head">
          <p className="preloader__brand">AI Multilingual Meet</p>
          <p className="preloader__tagline">{tagline}</p>
        </div>

        <div className="preloader__wave" aria-hidden="true">
          <span className="preloader__wave-bar" />
          <span className="preloader__wave-bar" />
          <span className="preloader__wave-bar" />
          <span className="preloader__wave-bar" />
          <span className="preloader__wave-bar" />
        </div>

        <div className="preloader__progress">
          <div className="preloader__track" aria-hidden="true">
            <span className="preloader__runner" />
          </div>
          <p className="preloader__status">{status}</p>
        </div>
      </div>
    </div>
  );
}
