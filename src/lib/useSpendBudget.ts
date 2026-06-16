import { useState, useEffect, useCallback, useMemo } from "react";
import {
  MAX_DAILY_ETH,
  MAX_SESSION_ETH,
  MAX_SINGLE_TX_ETH,
} from "@/lib/constants";

export interface SpendEntry {
  amount: number; // ETH
  timestamp: number;
  hash?: string;
  idempotencyKey?: string;
}

export interface SpendLimits {
  perTransaction: number; // Max ETH per single tx
  sessionTotal: number; // Max ETH per session
  dailyTotal: number; // Max ETH per 24h
}

export interface SpendStatus {
  perTx: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  };
  session: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  };
  daily: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  };
  isAtLimit: boolean;
  blockReason?: string; // Reason for blocking if isAtLimit
}

const STORAGE_KEY = "ledgr-spend-log";
const SESSION_START_KEY = "ledgr-session-start";

// Default conservative limits for Sepolia demo
const DEFAULT_LIMITS: SpendLimits = {
  perTransaction: MAX_SINGLE_TX_ETH,
  sessionTotal: MAX_SESSION_ETH,
  dailyTotal: MAX_DAILY_ETH,
};

function getSessionStart(): number {
  if (typeof window === "undefined") return Date.now();
  const stored = sessionStorage.getItem(SESSION_START_KEY);
  if (stored) {
    return parseInt(stored, 10);
  }
  const now = Date.now();
  sessionStorage.setItem(SESSION_START_KEY, now.toString());
  return now;
}

function loadSpendLog(): SpendEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

export function useSpendBudget(limits: Partial<SpendLimits> = {}) {
  const finalLimits = useMemo(
    () => ({ ...DEFAULT_LIMITS, ...limits }),
    [limits],
  );
  const [spendLog, setSpendLog] = useState<SpendEntry[]>(() => loadSpendLog());

  // Persist spend log to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(spendLog));
    } catch {
      // Ignore storage errors
    }
  }, [spendLog]);

  const calculateSpend = useCallback(
    (entries: SpendEntry[]): SpendStatus => {
      const now = Date.now();
      const sessionStart = getSessionStart();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      let sessionSpend = 0;
      let dailySpend = 0;

      entries.forEach((entry) => {
        if (entry.timestamp >= sessionStart) {
          sessionSpend += entry.amount;
        }
        if (entry.timestamp >= dayAgo) {
          dailySpend += entry.amount;
        }
      });

      const sessionRemaining = Math.max(
        0,
        finalLimits.sessionTotal - sessionSpend,
      );
      const dailyRemaining = Math.max(0, finalLimits.dailyTotal - dailySpend);

      const sessionPercentUsed =
        (sessionSpend / finalLimits.sessionTotal) * 100;
      const dailyPercentUsed = (dailySpend / finalLimits.dailyTotal) * 100;

      const isAtLimit =
        sessionSpend >= finalLimits.sessionTotal ||
        dailySpend >= finalLimits.dailyTotal;
      let blockReason: string | undefined;
      if (sessionSpend >= finalLimits.sessionTotal) {
        blockReason = "Session spend limit reached";
      } else if (dailySpend >= finalLimits.dailyTotal) {
        blockReason = "Daily spend limit reached";
      }

      return {
        perTx: {
          used: 0,
          limit: finalLimits.perTransaction,
          remaining: finalLimits.perTransaction,
          percentUsed: 0,
        },
        session: {
          used: sessionSpend,
          limit: finalLimits.sessionTotal,
          remaining: sessionRemaining,
          percentUsed: Math.min(100, sessionPercentUsed),
        },
        daily: {
          used: dailySpend,
          limit: finalLimits.dailyTotal,
          remaining: dailyRemaining,
          percentUsed: Math.min(100, dailyPercentUsed),
        },
        isAtLimit,
        blockReason,
      };
    },
    [finalLimits],
  );

  const getCurrentSpend = useCallback((): SpendStatus => {
    return calculateSpend(spendLog);
  }, [spendLog, calculateSpend]);

  const checkCanSpend = useCallback(
    (amount: number): { allowed: boolean; reason?: string } => {
      const status = calculateSpend(spendLog);

      if (amount > finalLimits.perTransaction) {
        return {
          allowed: false,
          reason: `Amount exceeds per-transaction limit of ${finalLimits.perTransaction} ETH`,
        };
      }

      if (status.session.used + amount > finalLimits.sessionTotal) {
        const remaining = status.session.remaining;
        return {
          allowed: false,
          reason: `Insufficient session budget. Remaining: ${remaining.toFixed(4)} ETH`,
        };
      }

      if (status.daily.used + amount > finalLimits.dailyTotal) {
        const remaining = status.daily.remaining;
        return {
          allowed: false,
          reason: `Insufficient daily budget. Remaining: ${remaining.toFixed(4)} ETH`,
        };
      }

      return { allowed: true };
    },
    [spendLog, calculateSpend, finalLimits],
  );

  const recordSpend = useCallback(
    (
      amount: number,
      opts?: {
        hash?: string;
        idempotencyKey?: string;
      },
    ): boolean => {
      // Dedupe by idempotency key: a reload or re-confirm of the same proposal
      // must never double-count against the budget.
      if (
        opts?.idempotencyKey &&
        spendLog.some((e) => e.idempotencyKey === opts.idempotencyKey)
      ) {
        return true;
      }

      const { allowed } = checkCanSpend(amount);
      if (!allowed) return false;

      const entry: SpendEntry = {
        amount,
        timestamp: Date.now(),
        hash: opts?.hash,
        idempotencyKey: opts?.idempotencyKey,
      };

      setSpendLog((prev) => {
        // Race-safe dedupe against the latest state inside the updater.
        if (
          opts?.idempotencyKey &&
          prev.some((e) => e.idempotencyKey === opts.idempotencyKey)
        ) {
          return prev;
        }
        const next = [...prev, entry];
        // Persist synchronously — the caller (ConfirmTxModal) unmounts
        // immediately after recording, before the persist effect can run.
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
        return next;
      });
      return true;
    },
    [checkCanSpend, spendLog],
  );

  const resetSession = useCallback((): void => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(SESSION_START_KEY);
    }
    setSpendLog([]);
  }, []);

  return {
    spendLog,
    limits: finalLimits,
    getCurrentSpend,
    checkCanSpend,
    recordSpend,
    resetSession,
  };
}
