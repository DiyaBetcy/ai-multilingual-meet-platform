import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ============================================================
   Workspace application shell.

   Ported from the approved OBSIDIAN INTELLIGENCE dashboard
   mockup (mockups/dashboard.html). It only owns layout and
   navigation — every page renders its own content inside
   <AppShell>.

   The four nav destinations are the application's real routes:
   Home (/start), Meetings (/meetings), Settings (/settings)
   and Profile (/profile).
   ============================================================ */

const NAV_ITEMS = [
  {
    key: "home",
    label: "Home",
    to: "/start",
    icon: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M9.5 21v-6h5v6" />
      </>
    ),
  },
  {
    key: "meetings",
    label: "Meetings",
    to: "/meetings",
    icon: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      </>
    ),
  },
  {
    key: "settings",
    label: "Settings",
    to: "/settings",
    icon: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.65 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.65a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.35 9v.03a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
      </>
    ),
  },
  {
    key: "profile",
    label: "Profile",
    to: "/profile",
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
  },
];

export default function AppShell({
  active = "home",
  title = "Home",
  crumb = "/ Workspace",
  topbarExtra = null,
  children,
}) {
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  const go = (to) => {
    setNavOpen(false);
    navigate(to);
  };

  /* The mobile drawer overlays the content (including the toggle), so
     Escape and the scrim below are the guaranteed ways out. */
  useEffect(() => {
    if (!navOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setNavOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navOpen]);

  return (
    <div className="oi-shell">
      <aside
        id="oi-sidebar"
        className={`oi-sidebar${navOpen ? " is-open" : ""}`}
      >
        <a className="oi-brand" onClick={() => go("/start")}>
          <span className="oi-brand-mark">M</span>
          <span>
            <span className="oi-brand-text">Meet</span>
            <span className="oi-brand-sub">Multilingual</span>
          </span>
        </a>

        <nav className="oi-nav" aria-label="Primary">
          <div className="oi-nav-heading">Workspace</div>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.key}
              className={`oi-nav-item${active === item.key ? " is-active" : ""}`}
              aria-current={active === item.key ? "page" : undefined}
              onClick={() => go(item.to)}
            >
              <span className="oi-nav-icon" aria-hidden="true">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {item.icon}
                </svg>
              </span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="oi-sidebar-foot">
          <button
            type="button"
            className="oi-btn oi-btn--primary oi-btn--block"
            onClick={() => go("/preview/create")}
          >
            <span className="oi-btn-icon" aria-hidden="true">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            New meeting
          </button>

          <div className="oi-user-card">
            <span className="avatar-circle avatar-circle--sm">ME</span>
            <span className="oi-user-info">
              <span className="oi-user-name">Your profile</span>
              <span className="oi-user-mail">Account &amp; settings</span>
            </span>
          </div>
        </div>
      </aside>

      {navOpen && (
        <div
          className="oi-shell-scrim"
          aria-hidden="true"
          onClick={() => setNavOpen(false)}
        />
      )}

      <div className="oi-main">
        <header className="oi-topbar">
          <button
            type="button"
            className="oi-topbar-toggle"
            aria-label="Toggle navigation"
            aria-controls="oi-sidebar"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((open) => !open)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <span className="oi-topbar-title">{title}</span>
          <span className="oi-topbar-crumb">{crumb}</span>
          <span className="oi-topbar-spacer" />
          {topbarExtra}
          <span
            className="avatar-circle avatar-circle--sm oi-topbar-avatar"
            role="button"
            tabIndex={0}
            onClick={() => go("/profile")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") go("/profile");
            }}
          >
            ME
          </span>
        </header>

        {children}
      </div>
    </div>
  );
}
