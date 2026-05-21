"use client";

import { useEffect, useRef } from "react";
import { SectionHeader } from "./SectionHeader";

const features = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11.5L3.5 14.5L5 9.5L1 6H6L8 1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
    ),
    title: "AI-Powered Wallet Operations",
    desc: "Describe intent in natural language. Ledgr plans, simulates, and executes with full transparency at every step.",
    tag: "Core",
    featured: true,
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L13 5V9C13 11.8 10.8 14.4 8 15C5.2 14.4 3 11.8 3 9V5L8 2Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Simulation Before Execution",
    desc: "Every transaction is dry-run on Sepolia before your wallet signs. No surprises on-chain.",
    tag: "Safety",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4H14M2 8H14M2 12H8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.1" />
        <path d="M12 11V12.5L13 13.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
    title: "Real-Time Audit Logs",
    desc: "Every agent action and tool call is logged with timestamps in an append-only audit trail.",
    tag: "Audit",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
        <path d="M5 5V4C5 2.9 5.9 2 7 2H9C10.1 2 11 2.9 11 4V5" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="8" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    ),
    title: "Security Supervisor",
    desc: "An independent layer reviews planned actions against injection guards, rate limits, and spend caps.",
    tag: "Security",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 8H13M8 3V13" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    ),
    title: "Spending Limits",
    desc: "Per-session and per-transaction limits enforced by architecture — not by model behavior.",
    tag: "Limits",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.1" />
        <path d="M8 5V8.5L10 10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
    title: "Reasoning Trace",
    desc: "Expand the full reasoning path behind every decision. No black boxes in financial operations.",
    tag: "Transparency",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.1" />
        <path d="M8 2V4M8 12V14M2 8H4M12 8H14" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
    title: "Sepolia Integration",
    desc: "Native testnet support with full transaction lifecycle from simulation to confirmation.",
    tag: "Network",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
        <path d="M12 9V15M9 12H15" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
    title: "Wallet Abstraction",
    desc: "Clean separation between intent, planning, execution, and wallet provider. Modular by design.",
    tag: "Architecture",
  },
];

export function FeaturesSection() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const cards = ref.current?.querySelectorAll(".feature-card");
    if (!cards) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("in-view");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <section id="features" className="landing-section" ref={ref}>
      <div className="landing-container">
        <SectionHeader
          label="Capabilities"
          title="Built for financial-grade reliability"
          description="Every capability exists because AI systems operating on financial infrastructure require it — not because it looks good on a landing page."
        />
        <div className="features-grid">
          {features.map((f) => (
            <article
              key={f.title}
              className={`feature-card scroll-reveal ${f.featured ? "feature-card-featured" : ""}`}
            >
              <div className="feature-top">
                <div className="feature-icon">{f.icon}</div>
                <span className="feature-tag">{f.tag}</span>
              </div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
