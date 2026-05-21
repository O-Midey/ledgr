"use client";

interface Props {
  onOpenWorkspace: () => void;
}

export function LandingNav({ onOpenWorkspace }: Props) {
  return (
    <nav className="landing-nav">
      <a href="#" className="landing-brand" aria-label="Ledgr home">
        <span className="brand-mark" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <path
              d="M4 13V5L9 2L14 5V13L9 16L4 13Z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path
              d="M9 7V11"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="brand-name">Ledgr</span>
        <span className="brand-badge">Sepolia</span>
      </a>

      <div className="nav-links">
        <a href="#features">Features</a>
        <a href="#architecture">Architecture</a>
        <a href="#security">Security</a>
      </div>

      <button
        type="button"
        className="btn-primary btn-sm"
        onClick={onOpenWorkspace}
      >
        Try Ledgr
      </button>
    </nav>
  );
}
