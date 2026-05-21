"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const TICKER = [
  { label: "ETH/USD", value: "3,241.88", change: "+2.4%" },
  { label: "GAS", value: "12 gwei", change: "" },
  { label: "SEPOLIA", value: "LIVE", change: "" },
  { label: "BTC/USD", value: "67,420.00", change: "+1.1%" },
];

const FEATURES = [
  {
    tag: "CORE",
    title: "AI-Powered Operations",
    desc: "Natural language wallet control. Describe intent — Ledgr plans, simulates, and executes with full auditability.",
  },
  {
    tag: "SAFETY",
    title: "Simulate Before Execute",
    desc: "Every transaction runs through a simulation layer before touching the chain. No surprises.",
  },
  {
    tag: "AUDIT",
    title: "Immutable Audit Logs",
    desc: "Every agent action, tool call, and decision is logged with timestamps and cryptographic integrity.",
  },
  {
    tag: "SECURITY",
    title: "Safety Supervisor",
    desc: "A dedicated supervisor layer reviews every planned action before execution. Hard limits enforced.",
  },
  {
    tag: "LIMITS",
    title: "Spending Controls",
    desc: "Set per-session and per-transaction spend limits. The agent cannot exceed them — by architecture.",
  },
  {
    tag: "TRACE",
    title: "Reasoning Transparency",
    desc: "Inspect the full reasoning trace behind every decision. No black boxes in financial operations.",
  },
  {
    tag: "NETWORK",
    title: "Sepolia Integration",
    desc: "Native Sepolia testnet support. Full transaction lifecycle from simulation to confirmation.",
  },
  {
    tag: "ARCH",
    title: "Wallet Abstraction",
    desc: "Clean separation between intent, planning, execution, and wallet provider. Modular by design.",
  },
];

const ARCH_NODES = [
  {
    id: "user",
    label: "User",
    sub: "Natural language intent",
    col: "text-[#EDEDED]",
  },
  {
    id: "goal",
    label: "GoalManager",
    sub: "Intent parsing & validation",
    col: "text-[#00D4AA]",
  },
  {
    id: "plan",
    label: "Planner",
    sub: "Step decomposition",
    col: "text-[#00D4AA]",
  },
  {
    id: "gate",
    label: "ExecutionGateway",
    sub: "Simulation + supervisor",
    col: "text-[#00D4AA]",
  },
  {
    id: "wallet",
    label: "WalletProvider",
    sub: "Signing & broadcast",
    col: "text-[#00D4AA]",
  },
  {
    id: "chain",
    label: "Blockchain",
    sub: "Sepolia / Mainnet",
    col: "text-[#A1A1A1]",
  },
];

const SECURITY = [
  {
    icon: "◈",
    title: "Immutable Audit Logs",
    desc: "Every action appended to a tamper-evident log. Full replay capability.",
  },
  {
    icon: "◈",
    title: "Typed Execution Pipeline",
    desc: "Strict TypeScript types enforce contract between every agent layer.",
  },
  {
    icon: "◈",
    title: "Simulation-Before-Actuation",
    desc: "Transactions are dry-run against a fork before any real broadcast.",
  },
  {
    icon: "◈",
    title: "Safety Supervisor",
    desc: "Independent review layer that can halt execution at any stage.",
  },
  {
    icon: "◈",
    title: "Idempotency Protection",
    desc: "Duplicate transaction prevention via content-addressed operation IDs.",
  },
];

function HeroBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-[0.07]"
        style={{
          background: "radial-gradient(ellipse, #00D4AA 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-32"
        style={{ background: "linear-gradient(to top, #0A0A0A, transparent)" }}
      />
    </div>
  );
}

function ProductMockup() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1800);
    return () => clearInterval(t);
  }, []);

  const msgs = [
    { role: "user", text: "Send 0.05 ETH to vitalik.eth" },
    {
      role: "assistant",
      text: "Resolving vitalik.eth → 0xd8dA...6045\nSimulating transfer of 0.05 ETH…\nEstimated gas: 21,000 @ 11 gwei = $0.87\nNo anomalies detected. Ready to execute.",
    },
    { role: "user", text: "Confirm" },
    {
      role: "assistant",
      text: "✓ Transaction broadcast\nHash: 0x4f3a…c91b\nStatus: Confirmed (block 6,842,301)",
    },
  ];

  const visible = msgs.slice(0, Math.min(tick + 1, msgs.length));

  return (
    <div
      className="relative w-full max-w-[520px] rounded-2xl overflow-hidden"
      style={{
        background: "#111111",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow:
          "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="w-3 h-3 rounded-full bg-[#EF4444] opacity-70" />
        <div className="w-3 h-3 rounded-full bg-[#F59E0B] opacity-70" />
        <div className="w-3 h-3 rounded-full bg-[#22C55E] opacity-70" />
        <span className="ml-3 text-xs font-mono text-[#525252]">
          ledgr — workspace
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: "rgba(0,212,170,0.1)", color: "#00D4AA" }}
          >
            ● SEPOLIA
          </span>
        </div>
      </div>

      {/* Wallet bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: "rgba(255,255,255,0.04)", background: "#0E0E0E" }}
      >
        <div>
          <div className="text-xs text-[#525252] font-mono">0xf39F...2266</div>
          <div className="text-sm font-mono font-semibold text-[#EDEDED]">
            2.4182 ETH
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-[#525252]">Gas estimate</div>
          <div className="text-xs font-mono text-[#F59E0B]">
            11 gwei · $0.87
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="px-4 py-4 space-y-4 min-h-[220px]">
        {visible.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "user" ? (
              <div
                className="text-sm px-3 py-2 rounded-xl max-w-[80%]"
                style={{
                  background: "#1C1C1C",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "#EDEDED",
                }}
              >
                {m.text}
              </div>
            ) : (
              <div className="text-sm max-w-[90%] text-[#EDEDED] leading-relaxed whitespace-pre-line">
                {m.text}
                {i === visible.length - 1 && tick < msgs.length && (
                  <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-[#00D4AA] align-middle animate-pulse" />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Audit strip */}
      <div
        className="px-4 py-2.5 border-t"
        style={{ borderColor: "rgba(255,255,255,0.04)", background: "#0E0E0E" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#525252] font-mono">AUDIT</span>
          <div className="flex gap-1.5">
            {[
              "goal_parsed",
              "plan_created",
              "simulated",
              "approved",
              "broadcast",
            ].map((s, i) => (
              <span
                key={s}
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{
                  background:
                    tick > i ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                  color: tick > i ? "#22C55E" : "#525252",
                  border: `1px solid ${tick > i ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.04)"}`,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "#0A0A0A", color: "#EDEDED" }}
    >
      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-14"
        style={{
          background: "rgba(10,10,10,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold tracking-tight text-[#EDEDED]">
            Ledgr
          </span>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(0,212,170,0.1)",
              color: "#00D4AA",
              border: "1px solid rgba(0,212,170,0.2)",
            }}
          >
            v0.1 · Sepolia
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-[#A1A1A1]">
          <a
            href="#features"
            className="hover:text-[#EDEDED] transition-colors"
          >
            Features
          </a>
          <a
            href="#architecture"
            className="hover:text-[#EDEDED] transition-colors"
          >
            Architecture
          </a>
          <a
            href="#security"
            className="hover:text-[#EDEDED] transition-colors"
          >
            Security
          </a>
        </div>
        <Link
          href="/chat"
          className="text-sm px-4 py-1.5 rounded-lg font-medium transition-all"
          style={{ background: "#00D4AA", color: "#0A0A0A" }}
        >
          Try Ledgr
        </Link>
      </nav>

      {/* Ticker */}
      <div
        className="fixed top-14 left-0 right-0 z-40 flex items-center gap-8 px-8 h-8 overflow-hidden"
        style={{
          background: "#0E0E0E",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {TICKER.map((t) => (
          <div key={t.label} className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-[#525252]">{t.label}</span>
            <span className="text-xs font-mono text-[#EDEDED]">{t.value}</span>
            {t.change && (
              <span className="text-xs font-mono text-[#22C55E]">
                {t.change}
              </span>
            )}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
          <span className="text-xs font-mono text-[#525252]">live</span>
        </div>
      </div>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-28 pb-24 px-8">
        <HeroBg />
        <div className="relative z-10 w-full max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div
                className="inline-flex items-center gap-2 mb-8 text-xs font-mono px-3 py-1.5 rounded-full"
                style={{
                  background: "rgba(0,212,170,0.08)",
                  border: "1px solid rgba(0,212,170,0.15)",
                  color: "#00D4AA",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
                AI Wallet Operating System
              </div>

              <h1
                className="text-5xl lg:text-7xl font-semibold tracking-tight leading-[1.05] mb-6"
                style={{ letterSpacing: "-0.03em" }}
              >
                Your wallet,
                <br />
                <span
                  style={{
                    background:
                      "linear-gradient(135deg, #EDEDED 30%, #525252 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  operated by
                  <br />
                  intelligence.
                </span>
              </h1>

              <p className="text-lg text-[#A1A1A1] leading-relaxed mb-10 max-w-lg">
                Ledgr is an AI-powered wallet OS that simulates before it
                executes, audits every action, and enforces safety by
                architecture — not by trust.
              </p>

              <div className="flex items-center gap-4">
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "#00D4AA", color: "#0A0A0A" }}
                >
                  Try Ledgr
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 7h8M7 3l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
                <a
                  href="#architecture"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all hover:bg-white/5"
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#A1A1A1",
                  }}
                >
                  View Architecture
                </a>
              </div>

              <div className="mt-12 flex items-center gap-8">
                {[
                  ["Simulate-first", "execution"],
                  ["Immutable", "audit logs"],
                  ["Safety", "supervisor"],
                ].map(([a, b]) => (
                  <div key={a}>
                    <div className="text-sm font-medium text-[#EDEDED]">
                      {a}
                    </div>
                    <div className="text-xs text-[#525252]">{b}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <ProductMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="py-32 px-8"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="text-xs font-mono text-[#525252] mb-4 tracking-widest">
              CAPABILITIES
            </div>
            <h2
              className="text-4xl font-semibold tracking-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              Built for financial-grade reliability.
            </h2>
            <p className="mt-4 text-[#A1A1A1] max-w-xl">
              Every feature in Ledgr exists because AI systems operating on
              financial infrastructure demand it.
            </p>
          </div>

          <div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-px"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="p-6 group transition-colors hover:bg-white/[0.02]"
                style={{ background: "#0A0A0A" }}
              >
                <div className="text-xs font-mono text-[#525252] mb-3 tracking-widest">
                  {f.tag}
                </div>
                <div className="text-sm font-semibold text-[#EDEDED] mb-2">
                  {f.title}
                </div>
                <div className="text-sm text-[#525252] leading-relaxed">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section
        id="architecture"
        className="py-32 px-8"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="text-xs font-mono text-[#525252] mb-4 tracking-widest">
              SYSTEM DESIGN
            </div>
            <h2
              className="text-4xl font-semibold tracking-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              Architecture.
            </h2>
            <p className="mt-4 text-[#A1A1A1] max-w-xl">
              A typed, layered execution pipeline. Each node has a single
              responsibility. Nothing is implicit.
            </p>
          </div>

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-0 overflow-x-auto pb-4">
            {ARCH_NODES.map((node, i) => (
              <div key={node.id} className="flex items-center">
                <div className="flex flex-col items-center text-center min-w-[120px]">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 relative"
                    style={{
                      background:
                        node.id === "user"
                          ? "rgba(255,255,255,0.04)"
                          : node.id === "chain"
                            ? "rgba(255,255,255,0.03)"
                            : "rgba(0,212,170,0.08)",
                      border: `1px solid ${node.id === "user" ? "rgba(255,255,255,0.08)" : node.id === "chain" ? "rgba(255,255,255,0.06)" : "rgba(0,212,170,0.2)"}`,
                    }}
                  >
                    <span
                      className="text-lg font-mono font-bold"
                      style={{
                        color:
                          node.id === "user"
                            ? "#EDEDED"
                            : node.id === "chain"
                              ? "#525252"
                              : "#00D4AA",
                      }}
                    >
                      {node.id === "user"
                        ? "U"
                        : node.id === "goal"
                          ? "G"
                          : node.id === "plan"
                            ? "P"
                            : node.id === "gate"
                              ? "E"
                              : node.id === "wallet"
                                ? "W"
                                : "⛓"}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#EDEDED] mb-1">
                    {node.label}
                  </div>
                  <div className="text-xs text-[#525252] leading-tight max-w-[100px]">
                    {node.sub}
                  </div>
                </div>
                {i < ARCH_NODES.length - 1 && (
                  <div className="flex items-center mx-2 md:mx-4">
                    <div
                      className="w-8 md:w-12 h-px"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(0,212,170,0.3), rgba(0,212,170,0.1))",
                      }}
                    />
                    <svg
                      width="6"
                      height="10"
                      viewBox="0 0 6 10"
                      fill="none"
                      className="shrink-0"
                    >
                      <path
                        d="M1 1l4 4-4 4"
                        stroke="#00D4AA"
                        strokeOpacity="0.4"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-4">
            {[
              {
                label: "Typed contracts",
                desc: "Every layer communicates through strict TypeScript interfaces. No implicit data flow.",
              },
              {
                label: "Isolated execution",
                desc: "Each node is independently testable. The gateway cannot be bypassed.",
              },
              {
                label: "Observable pipeline",
                desc: "Full observability at every stage. Every transition is logged and inspectable.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="p-5 rounded-xl"
                style={{
                  background: "#111111",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="text-sm font-semibold text-[#EDEDED] mb-2">
                  {item.label}
                </div>
                <div className="text-sm text-[#525252]">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section
        id="security"
        className="py-32 px-8"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <div className="text-xs font-mono text-[#525252] mb-4 tracking-widest">
                RELIABILITY
              </div>
              <h2
                className="text-4xl font-semibold tracking-tight mb-6"
                style={{ letterSpacing: "-0.02em" }}
              >
                AI systems for financial
                <br />
                actions must be reliable
                <br />
                <span style={{ color: "#00D4AA" }}>by architecture.</span>
              </h2>
              <p className="text-[#A1A1A1] leading-relaxed max-w-md">
                Trust is not a feature. It is the result of a system that cannot
                behave incorrectly — because the architecture prevents it.
              </p>
            </div>

            <div className="space-y-3">
              {SECURITY.map((s) => (
                <div
                  key={s.title}
                  className="flex gap-4 p-4 rounded-xl transition-colors hover:bg-white/[0.02]"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span className="text-[#00D4AA] mt-0.5 shrink-0 text-base">
                    {s.icon}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[#EDEDED] mb-1">
                      {s.title}
                    </div>
                    <div className="text-sm text-[#525252]">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-40 px-8 relative overflow-hidden"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(0,212,170,0.06) 0%, transparent 70%)",
          }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2
            className="text-5xl lg:text-6xl font-semibold tracking-tight mb-6"
            style={{ letterSpacing: "-0.03em" }}
          >
            Operate your wallet
            <br />
            with intelligence.
          </h2>
          <p className="text-[#A1A1A1] text-lg mb-10 max-w-lg mx-auto">
            The first AI wallet OS built for reliability, transparency, and
            control.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "#00D4AA", color: "#0A0A0A" }}
          >
            Launch Ledgr
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8h10M8 3l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-8 py-8 flex items-center justify-between"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#EDEDED]">Ledgr</span>
          <span className="text-xs text-[#525252]">
            AI Wallet Operating System
          </span>
        </div>
        <div className="text-xs font-mono text-[#525252]">
          v0.1.0 · Sepolia Testnet
        </div>
      </footer>
    </div>
  );
}
