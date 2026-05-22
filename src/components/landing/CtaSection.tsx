"use client";

import { useEffect, useRef } from "react";

interface Props {
  onLaunch: () => void;
}

export function CtaSection({ onLaunch }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector(".cta-inner");
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("in-view");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="cta-section" ref={ref}>
      <div className="cta-glow" aria-hidden />
      <div className="landing-container">
        <div className="cta-inner scroll-reveal">
          <div className="cta-eyebrow mono">
            {/* <span className="hero-eyebrow-dot" aria-hidden /> */}
            Get started
          </div>
          <h2 className="cta-title">
            Operate your wallet
            <br />
            with <span className="accent-text">intelligence.</span>
          </h2>
          <p className="cta-desc">
            Connect your wallet, describe your intent, and let Ledgr handle
            simulation, execution, and audit — with full transparency at every
            step.
          </p>
          <button
            type="button"
            className="btn-primary btn-lg cta-btn mono"
            onClick={onLaunch}
          >
            Launch Ledgr
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <p className="cta-note">Sepolia testnet · No real funds at risk</p>
        </div>
      </div>
    </section>
  );
}
