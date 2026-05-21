import { SectionHeader } from "./SectionHeader";

const features = [
  {
    title: "AI-Powered Wallet Operations",
    desc: "Describe intent in natural language. Ledgr plans, simulates, and executes with full transparency at every step.",
    tag: "Core",
    featured: true,
  },
  {
    title: "Simulation Before Execution",
    desc: "Every transaction is dry-run on Sepolia before your wallet signs. No surprises on-chain.",
    tag: "Safety",
  },
  {
    title: "Real-Time Audit Logs",
    desc: "Every agent action and tool call is logged with timestamps in an append-only audit trail.",
    tag: "Audit",
  },
  {
    title: "Security Supervisor",
    desc: "An independent layer reviews planned actions against injection guards, rate limits, and spend caps.",
    tag: "Security",
  },
  {
    title: "Spending Limits",
    desc: "Per-session and per-transaction limits enforced by architecture — not by model behavior.",
    tag: "Limits",
  },
  {
    title: "Reasoning Trace Transparency",
    desc: "Expand the full reasoning path behind every decision. No black boxes in financial operations.",
    tag: "Transparency",
  },
  {
    title: "Sepolia Integration",
    desc: "Native testnet support with full transaction lifecycle from simulation to confirmation.",
    tag: "Network",
  },
  {
    title: "Wallet Abstraction",
    desc: "Clean separation between intent, planning, execution, and wallet provider. Modular by design.",
    tag: "Architecture",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="landing-section">
      <div className="landing-container">
        <SectionHeader
          label="Capabilities"
          title="Built for financial-grade reliability"
          description="Every capability exists because AI systems operating on financial infrastructure require it — not because it looks good on a landing page."
        />
        <div className="features-grid">
          {features.map((f) => (
            <article key={f.title} className={`feature-card ${f.featured ? "feature-card-featured" : ""}`}>
              <div className="feature-top">
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
