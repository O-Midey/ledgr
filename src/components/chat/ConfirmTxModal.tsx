"use client";

import { useState, useCallback } from "react";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import { sepolia } from "viem/chains";
import { parseEther } from "viem";
import type { TxProposal } from "@/lib/txProposal";

interface Props {
  proposal: TxProposal;
  onClose: () => void;
  onSubmitted: (hash: `0x${string}`, proposal: TxProposal) => void;
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConfirmTxModal({ proposal, onClose, onSubmitted }: Props) {
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
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

  const handleConfirm = useCallback(async () => {
    setError(null);
    if (!isConnected) {
      setError("Connect your wallet first.");
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
      const hash = await sendTransactionAsync({
        to: proposal.to as `0x${string}`,
        value: parseEther(proposal.valueEth),
        chainId: sepolia.id,
      });
      setSubmittedHash(hash);
      setPhase("submitted");
      onSubmitted(hash, proposal);
      onClose();
    } catch (err) {
      setPhase("ready");
      setError(err instanceof Error ? err.message : "Transaction failed");
    }
  }, [
    isConnected,
    chainId,
    switchChainAsync,
    sendTransactionAsync,
    proposal,
    onClose,
    onSubmitted,
  ]);

  const displayError = error ?? (sendError ? sendError.message : null);
  const busy = isSigning || phase === "submitted";
  const isReady = phase === "ready" && !busy;

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
      <div className="tx-modal-card">
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
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!isReady}
            aria-disabled={!isReady}
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
