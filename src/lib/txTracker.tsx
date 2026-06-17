"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { sepolia } from "viem/chains";
import { formatEther, formatUnits } from "viem";
import type { TxPreviewStatus } from "@/components/chat/TxPreviewCard";

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * An in-flight (or just-settled) transaction, tagged with the conversation that
 * initiated it so its receipt always routes back to the originating chat — no
 * matter which conversation is open when it confirms.
 */
export type TrackedTx = TxPreviewStatus & { sessionId: string };

export interface TxNotice {
  id: string;
  sessionId: string;
  /** The proposal this receipt settles — used to resolve its tool call. */
  idempotencyKey: string;
  status: "confirmed" | "failed" | "reverted";
  hash: `0x${string}`;
  to: string;
  valueEth: string;
  createdAt?: number;
  blockNumber?: string;
  gasUsed?: string;
  effectiveGasPriceGwei?: string;
  txFeeEth?: string;
}

type Phase = TxPreviewStatus["phase"];

const TERMINAL_PHASES: ReadonlySet<Phase> = new Set<Phase>([
  "confirmed",
  "reverted",
  "failed",
]);

const isTerminal = (t: { phase: Phase }) => TERMINAL_PHASES.has(t.phase);
const isWatchable = (t: TrackedTx) =>
  !!t.hash && (t.phase === "submitted" || t.phase === "confirming");

const MAX_TRACKED = 20;

// ── Storage (account-scoped) ─────────────────────────────────────────────────

const INFLIGHT_PREFIX = "ledgr-tx-inflight:";
const RECEIPTS_PREFIX = "ledgr-tx-receipts:";

const inflightKey = (address: string) => `${INFLIGHT_PREFIX}${address}`;
const receiptsKey = (address: string) => `${RECEIPTS_PREFIX}${address}`;

function loadInflight(address: string | undefined): TrackedTx[] {
  if (typeof window === "undefined" || !address) return [];
  try {
    const raw = localStorage.getItem(inflightKey(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is TrackedTx =>
        !!t &&
        typeof t === "object" &&
        typeof t.idempotencyKey === "string" &&
        typeof t.sessionId === "string",
    );
  } catch {
    return [];
  }
}

function loadReceipts(address: string | undefined): TxNotice[] {
  if (typeof window === "undefined" || !address) return [];
  try {
    const raw = localStorage.getItem(receiptsKey(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (n): n is TxNotice =>
        !!n && typeof n === "object" && typeof n.sessionId === "string",
    );
  } catch {
    return [];
  }
}

/** Pull block/gas/fee fields off a wagmi receipt for the completion card. */
export function receiptMetrics(receipt: unknown): {
  blockNumber?: string;
  gasUsed?: string;
  effectiveGasPriceGwei?: string;
  txFeeEth?: string;
} {
  const r = receipt as {
    blockNumber?: bigint;
    gasUsed?: bigint;
    effectiveGasPrice?: bigint;
  };

  const blockNumber =
    typeof r?.blockNumber === "bigint" ? r.blockNumber.toString() : undefined;
  const gasUsed =
    typeof r?.gasUsed === "bigint" ? r.gasUsed.toString() : undefined;
  const effectiveGasPriceGwei =
    typeof r?.effectiveGasPrice === "bigint"
      ? Number(formatUnits(r.effectiveGasPrice, 9)).toFixed(2)
      : undefined;
  const txFeeEth =
    typeof r?.effectiveGasPrice === "bigint" && typeof r?.gasUsed === "bigint"
      ? Number(formatEther(r.effectiveGasPrice * r.gasUsed)).toFixed(6)
      : undefined;

  return { blockNumber, gasUsed, effectiveGasPriceGwei, txFeeEth };
}

// ── Context surface ──────────────────────────────────────────────────────────

interface TrackInput {
  hash: `0x${string}`;
  to: string;
  valueEth: string;
  idempotencyKey: string;
  sessionId: string;
}

interface SignatureInput {
  to: string;
  valueEth: string;
  idempotencyKey: string;
  sessionId: string;
}

export interface TxTrackerValue {
  /** Begin tracking a freshly broadcast transaction. */
  track(input: TrackInput): void;
  /** Mark a proposal as awaiting wallet signature (before a hash exists). */
  setSignatureRequested(input: SignatureInput): void;
  /**
   * Drop a proposal that never reached the chain (wallet reject, sign error,
   * or explicit cancel). Only clears entries WITHOUT a hash — a broadcast tx is
   * never untracked, so an in-flight transaction can't be lost.
   */
  clearPending(idempotencyKey: string): void;
  /** In-flight/terminal status for one proposal — drives the inline preview. */
  statusForKey(idempotencyKey: string): TxPreviewStatus | null;
  /** All statuses initiated by a conversation. */
  statusesForSession(sessionId: string): TxPreviewStatus[];
  /** Completion receipts for a conversation — drives the notice cards. */
  noticesForSession(sessionId: string): TxNotice[];
  /** Whether a proposal already has tracking (suppresses modal re-open). */
  isTracked(idempotencyKey: string): boolean;
  /** Non-terminal transaction count across the account. */
  pendingCount: number;
}

const TxTrackerContext = createContext<TxTrackerValue | null>(null);

export function useTxTracker(): TxTrackerValue {
  const ctx = useContext(TxTrackerContext);
  if (!ctx) {
    throw new Error("useTxTracker must be used within a TxTrackerProvider");
  }
  return ctx;
}

// ── Per-transaction chain watcher ────────────────────────────────────────────
// useWaitForTransactionReceipt is a hook, so it can't run in a loop. We render
// one watcher per in-flight tx instead; each resolves exactly once and lives at
// the account level, so it keeps watching across conversation switches.

function TxReceiptWatcher({
  tx,
  onConfirmed,
  onReverted,
  onFailed,
}: {
  tx: TrackedTx;
  onConfirmed: (tx: TrackedTx, receipt: unknown) => void;
  onReverted: (tx: TrackedTx, receipt: unknown) => void;
  onFailed: (tx: TrackedTx) => void;
}) {
  const { isSuccess, isError, data } = useWaitForTransactionReceipt({
    hash: tx.hash,
    chainId: sepolia.id,
    query: {
      enabled: tx.phase === "submitted" || tx.phase === "confirming",
      retry: 5,
    },
  });

  // Resolve once. The provider drives the tx terminal on resolution, which
  // unmounts this watcher; the ref guards the brief window before that lands.
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    if (isSuccess) {
      firedRef.current = true;
      const reverted =
        (data as { status?: string } | undefined)?.status === "reverted";
      if (reverted) onReverted(tx, data);
      else onConfirmed(tx, data);
    } else if (isError) {
      firedRef.current = true;
      onFailed(tx);
    }
  }, [isSuccess, isError, data, tx, onConfirmed, onReverted, onFailed]);

  return null;
}

// ── Account-scoped state holder ──────────────────────────────────────────────
// Keyed by address in the provider below, so switching wallets remounts this
// with a clean slate loaded from the new account's storage — no cross-account
// bleed — while conversation switches (which only remount ChatInterface) leave
// tx tracking untouched.

function AccountTxTracker({
  address,
  children,
}: {
  address: string | undefined;
  children: React.ReactNode;
}) {
  const [statuses, setStatuses] = useState<TrackedTx[]>(() =>
    loadInflight(address),
  );
  const [notices, setNotices] = useState<TxNotice[]>(() =>
    loadReceipts(address),
  );
  // Guards against appending a duplicate receipt if a watcher re-fires.
  const notifiedRef = useRef<Set<string>>(new Set());

  // Persist only non-terminal statuses. Terminal ones live for the session so
  // the inline preview can show "confirmed", but a reload should surface the
  // receipt card rather than a frozen preview.
  useEffect(() => {
    if (typeof window === "undefined" || !address) return;
    const open = statuses.filter((t) => !isTerminal(t)).slice(-MAX_TRACKED);
    try {
      if (open.length === 0) localStorage.removeItem(inflightKey(address));
      else localStorage.setItem(inflightKey(address), JSON.stringify(open));
    } catch {
      /* ignore */
    }
  }, [statuses, address]);

  useEffect(() => {
    if (typeof window === "undefined" || !address) return;
    try {
      localStorage.setItem(
        receiptsKey(address),
        JSON.stringify(notices.slice(-MAX_TRACKED)),
      );
    } catch {
      /* ignore */
    }
  }, [notices, address]);

  // submitted → confirming after a short beat (lets the "submitted" state show).
  // One timer per submitted tx; re-runs on status changes, which is fine — the
  // window is 700ms and submitted is a brief, transient phase.
  useEffect(() => {
    const submittedKeys = statuses
      .filter((t) => t.phase === "submitted")
      .map((t) => t.idempotencyKey);
    if (submittedKeys.length === 0) return;
    const timers = submittedKeys.map((key) =>
      window.setTimeout(() => {
        setStatuses((prev) =>
          prev.map((s) =>
            s.idempotencyKey === key && s.phase === "submitted"
              ? {
                  ...s,
                  phase: "confirming",
                  startedAt: s.startedAt || Date.now(),
                }
              : s,
          ),
        );
      }, 700),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [statuses]);

  // Flag confirming txs stuck after 60s so the inline card can surface help.
  // Gated on a primitive so the interval isn't torn down/recreated on every
  // unrelated status change.
  const hasConfirming = statuses.some(
    (t) => t.phase === "confirming" && !!t.startedAt,
  );
  useEffect(() => {
    if (!hasConfirming) return;
    const id = window.setInterval(() => {
      setStatuses((prev) =>
        prev.map((t) =>
          t.phase === "confirming" && t.startedAt
            ? { ...t, isStuck: Date.now() - t.startedAt > 60_000 }
            : t,
        ),
      );
    }, 5000);
    return () => window.clearInterval(id);
  }, [hasConfirming]);

  const appendNotice = useCallback(
    (
      tx: TrackedTx,
      notice: Omit<
        TxNotice,
        "sessionId" | "createdAt" | "idempotencyKey"
      >,
    ) => {
      if (notifiedRef.current.has(tx.hash ?? notice.id)) return;
      notifiedRef.current.add(tx.hash ?? notice.id);
      setNotices((prev) => [
        ...prev,
        {
          ...notice,
          sessionId: tx.sessionId,
          idempotencyKey: tx.idempotencyKey,
          createdAt: Date.now(),
        },
      ]);
    },
    [],
  );

  const setPhase = useCallback((idempotencyKey: string, phase: Phase) => {
    setStatuses((prev) =>
      prev.map((t) => (t.idempotencyKey === idempotencyKey ? { ...t, phase } : t)),
    );
  }, []);

  const handleConfirmed = useCallback(
    (tx: TrackedTx, receipt: unknown) => {
      setPhase(tx.idempotencyKey, "confirmed");
      if (!tx.hash) return;
      appendNotice(tx, {
        id: `confirmed-${tx.hash}`,
        status: "confirmed",
        hash: tx.hash,
        to: tx.to,
        valueEth: tx.valueEth,
        ...receiptMetrics(receipt),
      });
      // Record the verified spend/audit against the originating conversation.
      // The endpoint re-verifies on-chain and dedupes by hash, so a
      // fire-and-forget POST is safe even if it races a reload.
      void fetch("/api/tx/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: tx.sessionId,
          hash: tx.hash,
          valueEth: tx.valueEth,
          to: tx.to,
          idempotencyKey: tx.idempotencyKey,
        }),
      }).catch(() => {
        /* on-chain confirmation remains the source of truth */
      });
    },
    [setPhase, appendNotice],
  );

  const handleReverted = useCallback(
    (tx: TrackedTx, receipt: unknown) => {
      setPhase(tx.idempotencyKey, "reverted");
      if (!tx.hash) return;
      appendNotice(tx, {
        id: `reverted-${tx.hash}`,
        status: "reverted",
        hash: tx.hash,
        to: tx.to,
        valueEth: tx.valueEth,
        ...receiptMetrics(receipt),
      });
    },
    [setPhase, appendNotice],
  );

  const handleFailed = useCallback(
    (tx: TrackedTx) => {
      setPhase(tx.idempotencyKey, "failed");
      if (!tx.hash) return;
      appendNotice(tx, {
        id: `failed-${tx.hash}`,
        status: "failed",
        hash: tx.hash,
        to: tx.to,
        valueEth: tx.valueEth,
      });
    },
    [setPhase, appendNotice],
  );

  const track = useCallback((input: TrackInput) => {
    const next: TrackedTx = {
      ...input,
      phase: "submitted",
      startedAt: Date.now(),
      isStuck: false,
    };
    setStatuses((prev) => {
      if (prev.some((t) => t.idempotencyKey === input.idempotencyKey)) {
        return prev.map((t) =>
          t.idempotencyKey === input.idempotencyKey ? { ...t, ...next } : t,
        );
      }
      return [...prev, next].slice(-MAX_TRACKED);
    });
  }, []);

  const clearPending = useCallback((idempotencyKey: string) => {
    setStatuses((prev) =>
      prev.filter((t) => !(t.idempotencyKey === idempotencyKey && !t.hash)),
    );
  }, []);

  const setSignatureRequested = useCallback((input: SignatureInput) => {
    const sig: TrackedTx = {
      ...input,
      hash: undefined,
      phase: "signature_requested",
      startedAt: undefined,
      isStuck: false,
    };
    setStatuses((prev) => {
      if (prev.some((t) => t.idempotencyKey === input.idempotencyKey)) {
        return prev.map((t) =>
          t.idempotencyKey === input.idempotencyKey
            ? { ...t, phase: "signature_requested" }
            : t,
        );
      }
      return [...prev, sig].slice(-MAX_TRACKED);
    });
  }, []);

  const value = useMemo<TxTrackerValue>(
    () => ({
      track,
      setSignatureRequested,
      clearPending,
      statusForKey: (key) =>
        statuses.find((t) => t.idempotencyKey === key) ?? null,
      statusesForSession: (sid) => statuses.filter((t) => t.sessionId === sid),
      noticesForSession: (sid) => notices.filter((n) => n.sessionId === sid),
      isTracked: (key) => statuses.some((t) => t.idempotencyKey === key),
      // Only count transactions actually broadcast (have a hash) and not yet
      // settled — a tx merely awaiting signature isn't "confirming", and this
      // makes the indicator immune to a stranded signature-request entry.
      pendingCount: statuses.filter((t) => !isTerminal(t) && !!t.hash).length,
    }),
    [statuses, notices, track, setSignatureRequested, clearPending],
  );

  return (
    <TxTrackerContext.Provider value={value}>
      {statuses.filter(isWatchable).map((t) => (
        <TxReceiptWatcher
          key={t.idempotencyKey}
          tx={t}
          onConfirmed={handleConfirmed}
          onReverted={handleReverted}
          onFailed={handleFailed}
        />
      ))}
      {children}
    </TxTrackerContext.Provider>
  );
}

// ── Public provider ──────────────────────────────────────────────────────────

export function TxTrackerProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();

  // One-time migration: older builds stored tx status/receipts under a single
  // global key (which leaked receipts across chats), then under per-session
  // keys (which leaked across accounts). Both are superseded by the
  // account-scoped stores here, so drop the stale keys.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stale: string[] = ["ledgr-tx-status", "ledgr-tx-notices"];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith("ledgr-tx-status:") ||
            k.startsWith("ledgr-tx-notices:"))
        ) {
          stale.push(k);
        }
      }
      stale.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }, []);

  // Keyed by account: a wallet switch resets tracking to that account's data;
  // a conversation switch (which only remounts ChatInterface, a child) does not.
  return (
    <AccountTxTracker key={address ?? "__disconnected__"} address={address}>
      {children}
    </AccountTxTracker>
  );
}

// ── Header pending indicator ─────────────────────────────────────────────────

export function TxPendingIndicator() {
  const { pendingCount } = useTxTracker();
  if (pendingCount <= 0) return null;
  return (
    <span className="tx-pending-indicator" role="status" aria-live="polite">
      <span className="tx-pending-dot" aria-hidden="true" />
      {pendingCount} tx{pendingCount > 1 ? "s" : ""} confirming
    </span>
  );
}
