"use client";

import { useState, useEffect } from "react";

interface Props {
  onOpenWorkspace: () => void;
}

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#architecture", label: "Architecture" },
  { href: "#security", label: "Security" },
];

export function LandingNav({ onOpenWorkspace }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setMenuOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleNavClick = (href: string) => {
    setMenuOpen(false);
    // Let the menu close animation finish before scrolling
    setTimeout(() => {
      const id = href.replace("#", "");
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 240);
  };

  return (
    <>
      <nav className={`landing-nav ${scrolled ? "landing-nav-scrolled" : ""}`}>
        {/* Brand */}
        <a href="#" className="landing-brand" aria-label="Ledgr home">
          <span className="brand-mark" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path d="M4 13V5L9 2L14 5V13L9 16L4 13Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M9 7V11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </span>
          <span className="brand-name">Ledgr</span>
          <span className="nav-network-badge">
            <span className="nav-network-dot" />
            Sepolia
          </span>
        </a>

        {/* Desktop links */}
        <div className="nav-links" role="navigation">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="nav-link"
              onClick={(e) => {
                e.preventDefault();
                const id = l.href.replace("#", "");
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="nav-right">
          <button
            type="button"
            className="btn-primary btn-sm nav-cta"
            onClick={onOpenWorkspace}
          >
            Try Ledgr
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6H9.5M9.5 6L6.5 3M9.5 6L6.5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Hamburger — mobile only */}
          <button
            type="button"
            className={`nav-hamburger ${menuOpen ? "open" : ""}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`nav-mobile-menu ${menuOpen ? "open" : ""}`} aria-hidden={!menuOpen}>
        <div className="nav-mobile-inner">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="nav-mobile-link"
              onClick={(e) => { e.preventDefault(); handleNavClick(l.href); }}
            >
              {l.label}
            </a>
          ))}
          <button
            type="button"
            className="btn-primary nav-mobile-cta"
            onClick={() => { handleNavClick(""); onOpenWorkspace(); }}
          >
            Try Ledgr
          </button>
        </div>
      </div>

      {/* Backdrop */}
      {menuOpen && (
        <div className="nav-mobile-backdrop" onClick={() => setMenuOpen(false)} />
      )}
    </>
  );
}
