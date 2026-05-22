"use client";

import { useEffect, useRef } from "react";
import { ProductMockup } from "./ProductMockup";

interface Props {
  onOpenWorkspace: () => void;
}

export function HeroSection({ onOpenWorkspace }: Props) {
  const sectionRef = useRef<HTMLElement>(null);

  // Trigger animations only when in view
  useEffect(() => {
    const els = sectionRef.current?.querySelectorAll(".hero-animate");
    if (!els) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.animationPlayState = "running";
          }
        });
      },
      { threshold: 0.1 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className="hero-section" ref={sectionRef}>
      <div className="hero-atmosphere" aria-hidden />

      <div className="hero-inner">
        {/* ── Copy ── */}
        <div className="hero-copy">
          {/* <div className="hero-eyebrow hero-animate animate-fade-up opacity-0">
            <span className="hero-eyebrow-dot" aria-hidden />
            AI Wallet Operating System
          </div> */}

          <h1 className="hero-headline hero-animate animate-fade-up opacity-0 delay-100">
            Simulate. Audit.
            <br />
            <span className="accent-text">Execute.</span>
          </h1>

          <p className="hero-sub hero-animate animate-fade-up opacity-0 delay-200">
            Ledgr is an AI wallet OS built for reliability — every transaction
            is simulated before execution, every action is audited, and every
            decision is traceable.
          </p>

          <div className="hero-actions hero-animate animate-fade-up opacity-0 delay-300">
            <button
              type="button"
              className="btn-primary btn-hero"
              onClick={onOpenWorkspace}
            >
              Open Workspace
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path
                  d="M2.5 6.5H10.5M10.5 6.5L7 3M10.5 6.5L7 10"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {/* <a
              href="#architecture"
              className="btn-secondary btn-hero"
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById("architecture")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              View Architecture
            </a> */}
          </div>

          {/* Proof metrics */}
          <div className="hero-metrics hero-animate animate-fade-up opacity-0 delay-400">
            {[
              { value: "Simulate-first", label: "Execution policy" },
              { value: "Immutable", label: "Audit trail" },
              { value: "Sepolia", label: "Testnet native" },
            ].map((m) => (
              <div key={m.label} className="hero-metric">
                <div className="hero-metric-value">{m.value}</div>
                <div className="hero-metric-label">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Desktop mockup ── */}
        <div className="hero-preview hero-animate animate-fade-up opacity-0 delay-300">
          <ProductMockup />
        </div>
      </div>

      {/* ── Mobile inline preview ── */}
      <div className="hero-mobile-preview">
        <MobilePreview />
      </div>

      {/* ── Scroll indicator ── */}
      <div className="hero-scroll-hint" aria-hidden>
        <div className="hero-scroll-line" />
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 4L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  );
}

/** Compact inline preview shown only on mobile */
function MobilePreview() {
  return (
    <div className="mobile-preview-card">
      <div className="mobile-preview-row">
        <div className="mobile-preview-msg">Send 0.05 ETH to vitalik.eth</div>
      </div>
      <div className="mobile-preview-tools">
        <span className="tool-badge done">✓ resolveAddress</span>
        <span className="tool-badge done">✓ estimateGas</span>
        <span className="tool-badge running">… simulateTx</span>
      </div>
      <div className="mobile-preview-tx">
        <div className="tx-row">
          <span className="tx-label">Amount</span>
          <span className="tx-value accent">0.05 ETH</span>
        </div>
        <div className="tx-row">
          <span className="tx-label">Simulation</span>
          <span className="tx-value success">Passed</span>
        </div>
      </div>
    </div>
  );
}
