"use client";

import { useState } from "react";
import { isTxProposalOutput, isCancelledProposalOutput } from "@/lib/txProposal";

export interface ToolUIPart {
  type: string;
  toolCallId: string;
  toolName?: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

export interface TxPreviewStatus {
  hash?: `0x${string}`;
  to: string;
  valueEth: string;
  idempotencyKey: string;
  phase:
    | "signature_requested"
    | "submitted"
    | "confirming"
    | "confirmed"
    | "reverted"
    | "failed";
  startedAt?: number;
  isStuck?: boolean;
}

const PHASE_RANK: Record<TxPreviewStatus["phase"], number> = {
  signature_requested: 1,
  submitted: 2,
  confirming: 3,
  confirmed: 4,
  reverted: 4,
  failed: 3,
};

function truncateAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object")
    return value as Record<string, unknown>;
  return {};
}

export function TxPreviewCard({
  part,
  txStatus,
}: {
  part: ToolUIPart;
  txStatus?: TxPreviewStatus | null;
}) {
  const name = part.toolName ?? part.type.replace(/^tool-/, "");
  const input = parseRecord(part.input);
  const output = parseRecord(part.output);
  const isRunning =
    part.state === "input-streaming" || part.state === "input-available";
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
        {isRunning && (
          <div className="tx-preview-status running">Estimating…</div>
        )}
        {isError && (
          <div className="tx-preview-status error">
            {part.errorText ?? "Failed"}
          </div>
        )}
      </div>
    );
  }

  if (name === "sendTransaction") {
    if (isDone && isCancelledProposalOutput(output)) {
      const p = output.proposal;
      return (
        <div className="tx-preview chat-tx-preview tx-cancelled">
          <div className="tx-preview-label">Transaction cancelled</div>
          <div className="tx-row">
            <span className="tx-label">To</span>
            <span className="tx-value">{truncateAddr(p.to)}</span>
          </div>
          <div className="tx-row">
            <span className="tx-label">Amount</span>
            <span className="tx-value">{p.valueEth} ETH</span>
          </div>
          <div className="tx-preview-status cancelled">
            You cancelled this transaction — nothing was sent.
          </div>
        </div>
      );
    }

    if (isDone && isTxProposalOutput(output)) {
      const p = output.proposal;
      const matchingStatus =
        txStatus && txStatus.idempotencyKey === p.idempotencyKey
          ? txStatus
          : null;

      const statusText =
        matchingStatus?.phase === "signature_requested"
          ? "Signature requested in wallet…"
          : matchingStatus?.phase === "submitted"
            ? "Transaction submitted to Sepolia"
            : matchingStatus?.phase === "confirming"
              ? "Waiting for on-chain confirmation…"
              : matchingStatus?.phase === "confirmed"
                ? "Transaction confirmed on Sepolia"
                : matchingStatus?.phase === "reverted"
                  ? "Transaction reverted on-chain"
                  : matchingStatus?.phase === "failed"
                    ? "Confirmation delayed. Check explorer for latest status"
                    : "Awaiting your confirmation in the modal";

      const statusClass =
        matchingStatus?.phase === "confirmed"
          ? "done"
          : matchingStatus?.phase === "reverted" ||
              matchingStatus?.phase === "failed"
            ? "error"
            : "running";

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
          {matchingStatus?.hash && (
            <div className="tx-row">
              <span className="tx-label">Hash</span>
              <a
                href={`https://sepolia.etherscan.io/tx/${matchingStatus.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-value accent"
              >
                {truncateAddr(matchingStatus.hash)}
              </a>
            </div>
          )}
          {matchingStatus && (
            <div className="tx-timeline" aria-label="Transaction timeline">
              {[
                { key: "signature_requested", label: "Sign" },
                { key: "submitted", label: "Submitted" },
                { key: "confirming", label: "Confirming" },
                {
                  key:
                    matchingStatus.phase === "reverted" ||
                    matchingStatus.phase === "failed"
                      ? "failed"
                      : "confirmed",
                  label:
                    matchingStatus.phase === "reverted" ||
                    matchingStatus.phase === "failed"
                      ? "Failed"
                      : "Done",
                },
              ].map((step, index, arr) => {
                const currentRank = PHASE_RANK[matchingStatus.phase];
                const stepRank =
                  step.key === "failed"
                    ? 4
                    : PHASE_RANK[step.key as TxPreviewStatus["phase"]];

                const isError =
                  (matchingStatus.phase === "reverted" ||
                    matchingStatus.phase === "failed") &&
                  step.key === "failed";

                const state = isError
                  ? "error"
                  : stepRank < currentRank
                    ? "done"
                    : stepRank === currentRank
                      ? "active"
                      : "pending";

                return (
                  <div
                    key={step.key}
                    className={`tx-timeline-step ${state}`}
                    aria-current={state === "active" ? "step" : undefined}
                  >
                    <span className="tx-timeline-dot" />
                    <span className="tx-timeline-label">{step.label}</span>
                    {index < arr.length - 1 && (
                      <span className="tx-timeline-line" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {matchingStatus?.isStuck && matchingStatus.phase === "confirming" && (
            <div className="tx-stuck-actions">
              <div className="tx-stuck-label">
                ⏱️ Confirmation taking longer than usual
              </div>
              <div className="tx-stuck-hints">
                <div className="tx-stuck-hint">
                  <span className="hint-icon">⚡</span>
                  <span className="hint-text">
                    You can{" "}
                    <span className="hint-action">
                      speed up this transaction
                    </span>{" "}
                    by sending a new tx with higher gas from your wallet.
                  </span>
                </div>
                <div className="tx-stuck-hint">
                  <span className="hint-icon">🔗</span>
                  <span className="hint-text">
                    Check{" "}
                    <a
                      href={`https://sepolia.etherscan.io/tx/${matchingStatus.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hint-link"
                    >
                      Sepolia Explorer
                    </a>{" "}
                    for the latest status.
                  </span>
                </div>
              </div>
            </div>
          )}
          <div
            className={`tx-preview-status ${statusClass}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {statusText}
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
            {isDone
              ? "Passed"
              : isRunning
                ? "Running…"
                : isError
                  ? "Failed"
                  : "—"}
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
          <div className="tx-preview-status running">
            Preparing transaction…
          </div>
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
    <div className="activity-trace">
      <button
        type="button"
        className="activity-trace-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="activity-trace-label">Activity</span>
        <span className="activity-trace-count">{toolParts.length}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ marginLeft: "auto", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none", flexShrink: 0 }}
          aria-hidden
        >
          <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded && (
        <div className="activity-trace-body">
          {toolParts.map((tp) => {
            const toolName = tp.toolName ?? tp.type.replace(/^tool-/, "");
            const status =
              tp.state === "output-available" ? "done"
              : tp.state === "output-error" ? "error"
              : "running";
            return (
              <div key={tp.toolCallId} className="activity-step">
                <span className={`activity-dot ${status}`} />
                <span className="activity-step-name">{toolName}</span>
                <span className="activity-step-status">{status}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
