import { SectionHeader } from "./SectionHeader";

const pillars = [
  {
    num: "01",
    title: "Simulation Before Actuation",
    desc: "No transaction reaches the chain without passing a full simulation first.",
    detail: "viem simulateContract · Sepolia fork",
  },
  {
    num: "02",
    title: "Immutable Audit Logs",
    desc: "Every agent decision and tool invocation is written to an append-only log.",
    detail: "Structured · typed · queryable",
  },
  {
    num: "03",
    title: "Typed Execution Pipeline",
    desc: "The agent-to-blockchain path is fully typed. Malformed inputs fail at the boundary.",
    detail: "Zod schemas · InjectionGuard",
  },
  {
    num: "04",
    title: "Safety Supervisor",
    desc: "Monitors spending limits, rate limits, and anomalous patterns in real time.",
    detail: "CircuitBreaker on repeated failures",
  },
  {
    num: "05",
    title: "Idempotency Protection",
    desc: "Every operation carries a unique key. Duplicates are deduplicated before the wallet.",
    detail: "Safe under network retry",
  },
  {
    num: "06",
    title: "Spending Limits",
    desc: "Per-session and per-transaction caps enforced before execution — not after.",
    detail: "SpendTracker · hard limits",
  },
];

export function SecuritySection() {
  return (
    <section id="security" className="landing-section">
      <div className="landing-container">
        <SectionHeader
          label="Security & Reliability"
          title={
            <>
              Reliable by <span className="accent-text">architecture</span>
            </>
          }
          description="AI systems for financial actions must be reliable by architecture — not by prompt engineering or trust."
        />

        <div className="security-grid">
          {pillars.map((p) => (
            <article key={p.num} className="security-card">
              <div className="security-num">{p.num}</div>
              <h3 className="security-title">{p.title}</h3>
              <p className="security-desc">{p.desc}</p>
              <p className="security-detail">{p.detail}</p>
            </article>
          ))}
        </div>

        <div className="trust-row">
          <div>
            <div className="trust-title">Zero trust. Full transparency.</div>
            <p className="trust-desc">Every action logged. Every decision traceable. Every execution auditable.</p>
          </div>
          <div className="trust-pills">
            {["Simulation", "Audit log", "Typed pipeline", "Supervisor"].map((t) => (
              <span key={t} className="pill success">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
