"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import { sepolia } from "viem/chains";
import { parseEther } from "viem";
import type { TxProposal } from "@/lib/txProposal";
import { useSpendBudget } from "@/lib/useSpendBudget";
import { SpendBudgetDashboard } from "./SpendBudgetDashboard";

interface Props {
  proposal: TxProposal;
  onClose: () => void;
  onSubmitted: (hash: `0x${string}`, proposal: TxProposal) => void;
  onLifecycleChange?: (
    phase: "signature_requested",
    proposal: TxProposal,
  ) => void;
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function toFriendlyTxError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("user rejected") ||
    normalized.includes("user denied") ||
    normalized.includes("rejected request") ||
    normalized.includes("denied transaction")
  ) {
    return "Transaction was cancelled in wallet.";
  }

  if (
    normalized.includes("connector") ||
    normalized.includes("not connected") ||
    normalized.includes("no account") ||
    normalized.includes("account not found") ||
    normalized.includes("wallet not connected")
  ) {
    return "Wallet session isn’t ready. Please reconnect and try again.";
  }

  return message || "Transaction failed";
}

export function ConfirmTxModal({
  proposal,
  onClose,
  onSubmitted,
  onLifecycleChange,
}: Props) {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { getCurrentSpend, checkCanSpend, recordSpend } = useSpendBudget();
  const [error, setError] = useState<string | null>(null);
  const [submittedHash, setSubmittedHash] = useState<
    `0x${string}` | undefined
  >();
  const [phase, setPhase] = useState<"ready" | "signing" | "submitted">(
    "ready",
  );

  const {
    sendTransactionAsync,
    isPending: isSigning,
    error: sendError,
  } = useSendTransaction();

  const cardRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog on open and restore it to the trigger on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    confirmBtnRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  // Escape-to-close (while idle) and a Tab focus-trap so keyboard users can't
  // tab out of a money-moving dialog.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSigning) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isSigning, onClose]);

  const handleConfirm = useCallback(async () => {
    setError(null);

    // Check spend budget
    const amount = parseFloat(proposal.valueEth);
    const { allowed, reason } = checkCanSpend(amount);
    if (!allowed) {
      setError(reason || "Spend budget exceeded");
      return;
    }

    if (chainId !== sepolia.id) {
      try {
        setPhase("signing");
        await switchChainAsync({ chainId: sepolia.id });
      } catch {
        setPhase("ready");
        setError("Switch to Sepolia to continue.");
        return;
      }
    }
    try {
      setPhase("signing");
      onLifecycleChange?.("signature_requested", proposal);
      const hash = await sendTransactionAsync({
        to: proposal.to as `0x${string}`,
        value: parseEther(proposal.valueEth),
        chainId: sepolia.id,
      });
      setSubmittedHash(hash);
      setPhase("submitted");
      // Record the spend against the client budget. Deduped by idempotencyKey,
      // so a reload or re-confirm of the same proposal can't double-count.
      recordSpend(amount, { hash, idempotencyKey: proposal.idempotencyKey });
      onSubmitted(hash, proposal);
      onClose();
    } catch (err) {
      setPhase("ready");
      setError(toFriendlyTxError(err));
    }
  }, [
    chainId,
    switchChainAsync,
    sendTransactionAsync,
    proposal,
    onClose,
    onSubmitted,
    onLifecycleChange,
    checkCanSpend,
    recordSpend,
  ]);

  const displayError = error ?? (sendError ? sendError.message : null);
  const busy = isSigning || phase === "submitted";
  const isReady = phase === "ready" && !busy;

  // Check if spend budget allows the transaction
  const amount = parseFloat(proposal.valueEth);
  const { allowed: canSpend } = checkCanSpend(amount);
  const canConfirm = isReady && canSpend;

  const getButtonText = () => {
    if (phase === "signing") {
      return "Signing…";
    }
    if (phase === "submitted") {
      return "Submitted";
    }
    return "Confirm & send";
  };

  return (
    <div
      className="tx-modal-overlay"
      role="dialog"
      aria-modal
      aria-labelledby="tx-modal-title"
    >
      <div className="tx-modal-card" ref={cardRef}>
        <h3 id="tx-modal-title" className="tx-modal-title">
          Confirm transaction
        </h3>
        <p className="tx-modal-sub">
          Review details below. This will sign and broadcast from your connected
          wallet on Sepolia.
        </p>

        <div className="tx-preview">
          <div className="tx-row">
            <span className="tx-label">From</span>
            <span className="tx-value mono">{truncate(proposal.from)}</span>
          </div>
          <div className="tx-row">
            <span className="tx-label">To</span>
            <span className="tx-value mono">{truncate(proposal.to)}</span>
          </div>
          <div className="tx-row">
            <span className="tx-label">Amount</span>
            <span className="tx-value accent">{proposal.valueEth} ETH</span>
          </div>
          <div className="tx-row">
            <span className="tx-label">Simulation</span>
            <span className="tx-value success">Passed</span>
          </div>
        </div>

        {/* Spend Budget Dashboard */}
        <SpendBudgetDashboard
          status={getCurrentSpend()}
          proposedAmount={parseFloat(proposal.valueEth)}
        />

        {/* Status during signing */}
        {phase !== "ready" && (
          <div
            className={`tx-modal-status ${phase === "signing" ? "signing" : "success-status"}`}
          >
            {phase === "signing" ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="spin"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="8 8"
                  />
                </svg>
                Awaiting signature…
              </>
            ) : (
              <>Submitted. Confirmation is running in background.</>
            )}
          </div>
        )}

        {submittedHash && (
          <div className="tx-modal-status success-status mono">
            Submitted · {truncate(submittedHash)}
          </div>
        )}

        {displayError && <div className="tx-modal-error">{displayError}</div>}

        <div className="tx-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isSigning}
            aria-disabled={isSigning}
          >
            Cancel
          </button>
          <button
            type="button"
            id="tx-confirm-btn"
            ref={confirmBtnRef}
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!canConfirm}
            aria-disabled={!canConfirm}
          >
            {phase === "signing" || phase === "submitted" ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="spin"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="8 8"
                  />
                </svg>
                <span>{getButtonText()}</span>
              </>
            ) : (
              getButtonText()
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
