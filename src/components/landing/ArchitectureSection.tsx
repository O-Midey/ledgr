import { SectionHeader } from "./SectionHeader";

const pipeline = [
  { label: "User", sub: "Natural language", highlight: false },
  { label: "GoalManager", sub: "Intent parsing", highlight: false },
  { label: "Planner", sub: "Tool selection", highlight: false },
  { label: "ExecutionGateway", sub: "Simulate → execute", highlight: true },
  { label: "WalletProvider", sub: "Sign & broadcast", highlight: false },
  { label: "Blockchain", sub: "Sepolia", highlight: false },
];

const layers = [
  { title: "Security", items: ["InjectionGuard", "SpendTracker", "RateLimiter", "OutputFilter"] },
  { title: "Audit", items: ["AuditLog", "EpisodicMemory", "WorkingMemory", "IdempotencyStore"] },
  { title: "Verification", items: ["Verifier", "Supervisor", "CircuitBreaker", "Simulation"] },
];

export function ArchitectureSection() {
  return (
    <section id="architecture" className="landing-section landing-section-muted">
      <div className="landing-container">
        <SectionHeader
          label="Architecture"
          title="Typed execution pipeline, end to end"
          description="Every operation flows through a deterministic pipeline with safety checks at each boundary. Nothing is implicit."
        />

        <div className="arch-panel">
          <div className="arch-flow">
            {pipeline.map((node, i) => (
              <div key={node.label} style={{ display: "flex", alignItems: "center" }}>
                <div className="arch-node">
                  <div className={`arch-node-box ${node.highlight ? "highlight" : ""}`}>{node.label}</div>
                  <span className="arch-node-sub">{node.sub}</span>
                </div>
                {i < pipeline.length - 1 && <span className="arch-arrow">→</span>}
              </div>
            ))}
          </div>
          <div className="arch-layers">
            {layers.map((layer) => (
              <div key={layer.title} className="arch-layer">
                <div className="arch-layer-title">{layer.title}</div>
                <div className="arch-chips">
                  {layer.items.map((item) => (
                    <span key={item} className="arch-chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="code-block">
          <div className="code-block-head">executionGateway.ts</div>
          <pre className="code-block-body">
            <span className="code-kw">const</span> result = <span className="code-kw">await</span>{" "}
            <span className="code-fn">gateway</span>.execute({"{"} plan, {"{"} simulate: true, auditLog: true {"}"}
            {"}"});
          </pre>
        </div>
      </div>
    </section>
  );
}
