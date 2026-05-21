"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { tools: ["resolveAddress"], audit: 1, showTx: false, showModal: false, status: "" },
  { tools: ["resolveAddress", "estimateGas"], audit: 2, showTx: false, showModal: false, status: "" },
  { tools: ["resolveAddress", "estimateGas", "simulateTx"], audit: 3, showTx: true, showModal: false, status: "" },
  { tools: ["resolveAddress", "estimateGas", "simulateTx", "sendTransaction"], audit: 5, showTx: true, showModal: true, status: "pending" },
  { tools: ["resolveAddress", "estimateGas", "simulateTx", "sendTransaction"], audit: 5, showTx: true, showModal: false, status: "confirmed" },
] as const;

const ALL_TOOLS = ["resolveAddress", "estimateGas", "simulateTx", "sendTransaction"];

export function ProductMockup() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];

  useEffect(() => {
    const id = setInterval(() => setStep((v) => (v + 1) % STEPS.length), 3200);
    return () => clearInterval(id);
  }, []);

  const toolState = (name: string) => {
    const tools = s.tools as readonly string[];
    const idx = tools.indexOf(name);
    if (idx < 0) return "";
    if (idx === tools.length - 1 && s.status === "pending") return "running";
    return "done";
  };

  return (
    <div className="preview-frame">
      <div className="preview-chrome">
        <span className="preview-dot" style={{ background: "#555" }} />
        <span className="preview-dot" style={{ background: "#555" }} />
        <span className="preview-dot" style={{ background: "#555" }} />
        <span className="preview-title">ledgr — workspace</span>
        <span className="preview-badge">Sepolia</span>
      </div>

      <div className="preview-body">
        <div className="preview-main">
          <div className="preview-messages">
            <div className="preview-user">Send 0.05 ETH to vitalik.eth</div>

            <div className="preview-trace">
              <div className="preview-trace-head">Reasoning trace</div>
              <div className="preview-trace-body">
                {`Resolving vitalik.eth via ENS
Estimating gas for 0.05 ETH transfer
Running simulation on Sepolia fork`}
                {s.showTx ? "\nSimulation passed — awaiting confirmation" : ""}
              </div>
            </div>

            <div className="preview-tools">
              {ALL_TOOLS.map((name) => (
                <span key={name} className={`tool-badge ${toolState(name)}`}>
                  {toolState(name) === "done" ? "✓" : toolState(name) === "running" ? "…" : "·"}{" "}
                  {name}
                </span>
              ))}
            </div>

            {s.showTx && (
              <div className="tx-preview">
                <div className="tx-preview-label">Transaction preview</div>
                <div className="tx-row">
                  <span className="tx-label">To</span>
                  <span className="tx-value">0xd8dA…6045</span>
                </div>
                <div className="tx-row">
                  <span className="tx-label">Amount</span>
                  <span className="tx-value accent">0.05 ETH</span>
                </div>
                <div className="tx-row">
                  <span className="tx-label">Gas</span>
                  <span className="tx-value">21,000 · 11 gwei</span>
                </div>
                <div className="tx-row">
                  <span className="tx-label">Simulation</span>
                  <span className="tx-value success">Passed</span>
                </div>
              </div>
            )}
          </div>

          <div className="preview-input">
            <div className="preview-input-inner">
              <span>Ask anything about your wallet…</span>
              <span className="preview-send" aria-hidden>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5H8M8 5L5.5 2.5M8 5L5.5 7.5" stroke="#0A0A0A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        <aside className="preview-sidebar">
          <div className="preview-side-block">
            <div className="preview-side-label">Balance</div>
            <div className="preview-balance">1.2847</div>
            <div className="preview-balance-sub">ETH</div>
          </div>
          <div className="preview-side-block">
            <div className="preview-side-label">Audit log</div>
            {ALL_TOOLS.map((action, i) => {
              const active = i < s.audit;
              const running = i === s.audit - 1 && s.status === "pending";
              return (
                <div key={action} className="preview-audit-item">
                  <span className={`preview-audit-dot ${active ? (running ? "running" : "done") : ""}`} />
                  {action}
                </div>
              );
            })}
          </div>
          <div className="preview-side-block">
            <div className="preview-side-label">Safety</div>
            {["Simulation", "Supervisor", "Spend limits"].map((label) => (
              <div key={label} className="tx-row">
                <span className="tx-label">{label}</span>
                <span className="tx-value success">on</span>
              </div>
            ))}
          </div>
        </aside>

        {s.showModal && (
          <div className="preview-modal">
            <div className="preview-modal-card">
              <div className="preview-modal-title">Confirm transaction</div>
              <div className="preview-modal-sub">0.05 ETH → vitalik.eth · Sepolia</div>
              <div className="tx-row">
                <span className="tx-label">Est. fee</span>
                <span className="tx-value">$0.87</span>
              </div>
              <div className="preview-modal-actions">
                <button type="button" className="preview-modal-btn">Cancel</button>
                <button type="button" className="preview-modal-btn primary">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {s.status && (
        <div className={`preview-status ${s.status === "confirmed" ? "live" : ""}`}>
          <span className={`preview-audit-dot ${s.status === "confirmed" ? "done" : "running"}`} />
          {s.status === "confirmed"
            ? "0x4f3a…c91b · Confirmed · block 6,842,301"
            : "Broadcasting · waiting for confirmation…"}
        </div>
      )}
    </div>
  );
}
