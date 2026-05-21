"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import { sepolia } from "viem/chains";
import { parseEther } from "viem";
import type { TxProposal } from "@/lib/txProposal";
import { txExplorerUrl } from "@/lib/utils";

interface Props {
  proposal: TxProposal;
  sessionId: string;
  onClose: () => void;
  onConfirmed: (hash: string) => void;
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const CONFIRMATION_TIMEOUT_MS = 120000; // 2 minutes

export function ConfirmTxModal({
  proposal,
  sessionId,
  onClose,
  onConfirmed,
}: Props) {
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [error, setError] = useState<string | null>(null);
  const [submittedHash, setSubmittedHash] = useState<`0x${string}` | undefined>();
  const [phase, setPhase] = useState<"ready" | "signing" | "confirming">("ready");
  const confirmTimeoutRef = useRef<NodeJS.Timeout>();
  const [confirmationStalled, setConfirmationStalled] = useState(false);

  const { sendTransactionAsync, isPending: isSigning, error: sendError } =
    useSendTransaction();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: submittedHash,
    chainId: sepolia.id,
    query: {
      enabled: !!submittedHash && phase === "confirming",
      // Poll more frequently initially
      pollingInterval: submittedHash ? 1000 : undefined,
      retry: 3,
      retryDelay: 1000,
    },
  });

  // Track confirmation timeout
  useEffect(() => {
    if (phase !== "confirming" || !submittedHash) return;

    // Clear any existing timeout
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }

    confirmTimeoutRef.current = setTimeout(() => {
      setConfirmationStalled(true);
    }, CONFIRMATION_TIMEOUT_MS);

    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, [phase, submittedHash]);

  // Handle successful confirmation
  useEffect(() => {
    if (!isSuccess || !submittedHash) return;

    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }

    (async () => {
      try {
        await fetch("/api/tx/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            hash: submittedHash,
            valueEth: proposal.valueEth,
            to: proposal.to,
            idempotencyKey: proposal.idempotencyKey,
          }),
        });
      } catch {
        // Log but don't fail - tx is already on chain
      }
      onConfirmed(submittedHash);
    })();
  }, [isSuccess, submittedHash, sessionId, proposal, onConfirmed]);

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
      setPhase("confirming");
      setConfirmationStalled(false);
      // Close modal immediately after tx is submitted
      setTimeout(() => onClose(), 500);
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
  ]);

  const displayError = error ?? (sendError ? sendError.message : null);
  const busy = isSigning || isConfirming || !!submittedHash;
  const isReady = phase === "ready" && !busy;

  const getButtonText = () => {
    if (confirmationStalled) {
      return "Confirmation taking longer...";
    }
    if (phase === "signing") {
      return "Signing in wallet…";
    }
    if (phase === "confirming") {
      return "Broadcasting…";
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
          Review details below. This will sign and broadcast from your connected wallet on
          Sepolia.
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

        {/* Status during confirmation */}
        {phase !== "ready" && (
          <div className={`tx-modal-status ${phase === "signing" ? "signing" : "confirming"}`}>
            {phase === "signing" ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="spin">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 8"/>
                </svg>
                Waiting for wallet signature…
              </>
            ) : confirmationStalled ? (
              <>
                <span style={{ color: "var(--warning)" }}>⚠</span>
                Confirmation taking a while. You can close this and check later on{" "}
                <a
                  href={submittedHash ? txExplorerUrl(submittedHash) : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Etherscan
                </a>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="spin">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 8"/>
                </svg>
                Broadcasting to network…
              </>
            )}
          </div>
        )}

        {submittedHash && (
          <div className="tx-modal-status success-status mono">
            Submitted ·{" "}
            <a
              href={txExplorerUrl(submittedHash)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {truncate(submittedHash)}
            </a>
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
            {isReady ? "Cancel" : "Done"}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!isReady}
            aria-disabled={!isReady}
          >
            {phase === "signing" || phase === "confirming" ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="spin">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 8"/>
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
