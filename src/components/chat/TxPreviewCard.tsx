"use client";

import { useState } from "react";
import { isTxProposalOutput } from "@/lib/txProposal";

export interface ToolUIPart {
  type: string;
  toolCallId: string;
  toolName?: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

function truncateAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

export function TxPreviewCard({ part }: { part: ToolUIPart }) {
  const name = part.toolName ?? part.type.replace(/^tool-/, "");
  const input = parseRecord(part.input);
  const output = parseRecord(part.output);
  const isRunning =
    part.state === "input-streaming" ||
    part.state === "input-available";
  const isError = part.state === "output-error";
  const isDone = part.state === "output-available";

  if (name === "estimateGas") {
    const to = typeof input.to === "string" ? input.to : "—";
    const amount =
      typeof input.valueEth === "string"
        ? input.valueEth
        : typeof input.value === "number"
          ? String(input.value)
          : "—";

    return (
      <div className="tx-preview chat-tx-preview">
        <div className="tx-preview-label">Gas estimate</div>
        <div className="tx-row">
          <span className="tx-label">To</span>
          <span className="tx-value">{truncateAddr(to)}</span>
        </div>
        <div className="tx-row">
          <span className="tx-label">Amount</span>
          <span className="tx-value accent">{amount} ETH</span>
        </div>
        {isDone && typeof output.totalCostEth === "string" && (
          <div className="tx-row">
            <span className="tx-label">Est. fee</span>
            <span className="tx-value">{output.totalCostEth} ETH</span>
          </div>
        )}
        {isRunning && <div className="tx-preview-status running">Estimating…</div>}
        {isError && (
          <div className="tx-preview-status error">{part.errorText ?? "Failed"}</div>
        )}
      </div>
    );
  }

  if (name === "sendTransaction") {
    if (isDone && isTxProposalOutput(output)) {
      const p = output.proposal;
      return (
        <div className="tx-preview chat-tx-preview">
          <div className="tx-preview-label">Transaction preview</div>
          <div className="tx-row">
            <span className="tx-label">To</span>
            <span className="tx-value">{truncateAddr(p.to)}</span>
          </div>
          <div className="tx-row">
            <span className="tx-label">Amount</span>
            <span className="tx-value accent">{p.valueEth} ETH</span>
          </div>
          <div className="tx-row">
            <span className="tx-label">Simulation</span>
            <span className="tx-value success">Passed</span>
          </div>
          <div className="tx-preview-status running">
            Awaiting your confirmation in the modal
          </div>
        </div>
      );
    }

    const to = typeof input.to === "string" ? input.to : "—";
    const amount =
      typeof input.valueEth === "string"
        ? input.valueEth
        : typeof input.value === "number"
          ? String(input.value)
          : "—";
    const hash = typeof output.hash === "string" ? output.hash : null;
    const explorer =
      typeof output.explorerUrl === "string" ? output.explorerUrl : null;

    return (
      <div className="tx-preview chat-tx-preview">
        <div className="tx-preview-label">Transaction</div>
        <div className="tx-row">
          <span className="tx-label">To</span>
          <span className="tx-value">{truncateAddr(to)}</span>
        </div>
        <div className="tx-row">
          <span className="tx-label">Amount</span>
          <span className="tx-value accent">{amount} ETH</span>
        </div>
        <div className="tx-row">
          <span className="tx-label">Simulation</span>
          <span
            className={`tx-value ${isDone ? "success" : isError ? "danger" : ""}`}
          >
            {isDone ? "Passed" : isRunning ? "Running…" : isError ? "Failed" : "—"}
          </span>
        </div>
        {isDone && hash && (
          <div className="tx-row">
            <span className="tx-label">Hash</span>
            {explorer ? (
              <a
                href={explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-value accent"
              >
                {truncateAddr(hash)}
              </a>
            ) : (
              <span className="tx-value mono">{truncateAddr(hash)}</span>
            )}
          </div>
        )}
        {isRunning && (
          <div className="tx-preview-status running">Preparing transaction…</div>
        )}
      </div>
    );
  }

  return null;
}

export function ActivityTrace({ toolParts }: { toolParts: ToolUIPart[] }) {
  const [expanded, setExpanded] = useState(false);

  if (toolParts.length === 0) return null;

  return (
    <div className="reasoning-trace">
      <button
        type="button"
        className="reasoning-trace-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        Activity
        <span className="reasoning-trace-count mono">{toolParts.length}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`reasoning-chevron ${expanded ? "open" : ""}`}
          aria-hidden
        >
          <path
            d="M2 4L5 7L8 4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {expanded && (
        <div className="reasoning-trace-body activity-trace-body">
          {toolParts.map((tp) => {
            const toolName = tp.toolName ?? tp.type.replace(/^tool-/, "");
            const status =
              tp.state === "output-available"
                ? "done"
                : tp.state === "output-error"
                  ? "error"
                  : "running";
            return (
              <div key={tp.toolCallId} className="activity-step">
                <span className={`activity-dot ${status}`} />
                <span className="mono">{toolName}</span>
                <span className="activity-state">{status}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
