import { ProductMockup } from "./ProductMockup";

interface Props {
  onOpenWorkspace: () => void;
}

export function HeroSection({ onOpenWorkspace }: Props) {
  return (
    <section className="hero-section">
      <div className="hero-atmosphere" aria-hidden />

      <div className="hero-inner">
        <div className="hero-copy">
          <div className="hero-eyebrow animate-fade-up opacity-0">
            <span className="hero-eyebrow-dot" aria-hidden />
            AI Wallet Operating System
          </div>

          <h1 className="hero-headline animate-fade-up opacity-0 delay-100">
            Operate your wallet
            <br />
            with <span className="accent-text">intelligence</span>
          </h1>

          <p className="hero-sub animate-fade-up opacity-0 delay-200">
            Ledgr is an AI wallet OS built for reliability — simulate every
            transaction before execution, audit every action, and manage
            on-chain operations through natural language.
          </p>

          <div className="hero-actions animate-fade-up opacity-0 delay-300">
            <button
              type="button"
              className="btn-primary"
              onClick={onOpenWorkspace}
            >
              Try Ledgr
            </button>
            <a href="#architecture" className="btn-secondary">
              View Architecture
            </a>
          </div>

          <div className="hero-metrics animate-fade-up opacity-0 delay-400">
            {[
              { value: "Simulate-first", label: "Execution policy" },
              { value: "Immutable", label: "Audit logs" },
              { value: "Sepolia", label: "Testnet native" },
            ].map((m) => (
              <div key={m.label}>
                <div className="hero-metric-value">{m.value}</div>
                <div className="hero-metric-label">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-preview animate-fade-up opacity-0 delay-300">
          <ProductMockup />
        </div>
      </div>
    </section>
  );
}
