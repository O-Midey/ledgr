"use client";

import { useEffect, useRef } from "react";
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
  {
    title: "Security",
    color: "var(--warning)",
    bg: "rgba(245,158,11,0.05)",
    border: "rgba(245,158,11,0.14)",
    items: ["InjectionGuard", "SpendTracker", "RateLimiter", "OutputFilter"],
  },
  {
    title: "Audit",
    color: "var(--accent)",
    bg: "rgba(0,212,170,0.05)",
    border: "rgba(0,212,170,0.14)",
    items: ["AuditLog", "EpisodicMemory", "WorkingMemory", "IdempotencyStore"],
  },
  {
    title: "Verification",
    color: "var(--success)",
    bg: "rgba(34,197,94,0.05)",
    border: "rgba(34,197,94,0.14)",
    items: ["Verifier", "Supervisor", "CircuitBreaker", "Simulation"],
  },
];

const codeLines = [
  { tokens: [{ t: "comment", v: "// Every execution follows this typed pipeline" }] },
  {
    tokens: [
      { t: "kw", v: "import" },
      { t: "plain", v: " { gateway } " },
      { t: "kw", v: "from" },
      { t: "str", v: ' "@/agent/executionGateway"' },
    ],
  },
  { tokens: [] },
  {
    tokens: [
      { t: "kw", v: "const" },
      { t: "plain", v: " result = " },
      { t: "kw", v: "await" },
      { t: "plain", v: " " },
      { t: "fn", v: "gateway" },
      { t: "plain", v: ".execute({" },
    ],
  },
  { tokens: [{ t: "plain", v: "  plan," }] },
  {
    tokens: [
      { t: "plain", v: "  { simulate: " },
      { t: "kw", v: "true" },
      { t: "plain", v: ", auditLog: " },
      { t: "kw", v: "true" },
      { t: "plain", v: ", idempotencyKey }," },
    ],
  },
  { tokens: [{ t: "plain", v: "});" }] },
  { tokens: [] },
  {
    tokens: [
      { t: "comment", v: "// result: " },
      { t: "plain", v: "{ txHash, auditId, simulation, gasUsed }" },
    ],
  },
];

export function ArchitectureSection() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const els = ref.current?.querySelectorAll(".scroll-reveal");
    if (!els) return;
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
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section id="architecture" className="landing-section landing-section-muted" ref={ref}>
      <div className="landing-container">
        <SectionHeader
          label="Architecture"
          title="Typed execution pipeline, end to end"
          description="Every operation flows through a deterministic pipeline with safety checks at each boundary. Nothing is implicit."
        />

        <div className="arch-panel scroll-reveal">
          {/* Horizontal pipeline — desktop */}
          <div className="arch-flow arch-flow-h">
            {pipeline.map((node, i) => (
              <div key={node.label} className="arch-flow-item">
                <div className="arch-node">
                  <div className={`arch-node-box ${node.highlight ? "highlight" : ""}`}>
                    {node.label}
                  </div>
                  <span className="arch-node-sub">{node.sub}</span>
                </div>
                {i < pipeline.length - 1 && (
                  <span className="arch-arrow arch-arrow-h">→</span>
                )}
              </div>
            ))}
          </div>

          {/* Vertical pipeline — mobile */}
          <div className="arch-flow arch-flow-v">
            {pipeline.map((node, i) => (
              <div key={node.label} className="arch-flow-v-item">
                <div className={`arch-node-box ${node.highlight ? "highlight" : ""}`}>
                  {node.label}
                  <span className="arch-node-sub-inline">{node.sub}</span>
                </div>
                {i < pipeline.length - 1 && (
                  <span className="arch-arrow arch-arrow-v">↓</span>
                )}
              </div>
            ))}
          </div>

          {/* Cross-cutting layers */}
          <div className="arch-layers">
            {layers.map((layer) => (
              <div
                key={layer.title}
                className="arch-layer"
                style={{
                  background: layer.bg,
                  borderColor: layer.border,
                }}
              >
                <div className="arch-layer-title" style={{ color: layer.color }}>
                  {layer.title}
                </div>
                <div className="arch-chips">
                  {layer.items.map((item) => (
                    <span key={item} className="arch-chip" style={{ borderColor: layer.border }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Code block */}
        <div className="code-block scroll-reveal">
          <div className="code-block-head">
            <span className="code-block-dot" />
            executionGateway.ts
          </div>
          <pre className="code-block-body">
            {codeLines.map((line, i) => (
              <div key={i} className="code-line">
                <span className="code-lineno">{(i + 1).toString().padStart(2, " ")}</span>
                <span className="code-content">
                  {line.tokens.map((tok, j) => (
                    <span key={j} className={`code-${tok.t}`}>{tok.v}</span>
                  ))}
                </span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </section>
  );
}
