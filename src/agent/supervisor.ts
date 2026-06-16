import { SpendTracker } from "@/security/spendTracker";
import { SupervisorVetoError } from "@/types/errors";

/**
 * SafetySupervisor — final veto gate before any side-effectful commit.
 * Its decision is final and cannot be overridden.
 *
 * Spend limits are tracked PER SESSION. A single global tracker would let one
 * user's spend exhaust ("session limit") or block every other user, so each
 * session gets its own append-only tracker. Idle trackers are evicted to keep
 * memory bounded.
 *
 * NOTE: this state lives in process memory. On a single long-lived server it is
 * correct but resets on deploy/restart and is not shared across instances. For
 * multi-instance durability, back this with Redis/Postgres keyed by session.
 */
const DEFAULT_KEY = "__global__";
const TRACKER_TTL_MS = 1000 * 60 * 60 * 24 * 2; // evict sessions idle > 2 days

interface TrackerEntry {
  tracker: SpendTracker;
  lastSeen: number;
}

const trackers = new Map<string, TrackerEntry>();

function evictStale(now: number): void {
  for (const [key, entry] of trackers) {
    if (now - entry.lastSeen > TRACKER_TTL_MS) {
      trackers.delete(key);
    }
  }
}

function getTracker(sessionId?: string): SpendTracker {
  const key = sessionId?.trim() || DEFAULT_KEY;
  const now = Date.now();
  evictStale(now);

  const existing = trackers.get(key);
  if (existing) {
    existing.lastSeen = now;
    return existing.tracker;
  }

  const tracker = new SpendTracker();
  trackers.set(key, { tracker, lastSeen: now });
  return tracker;
}

function valueEthOf(input: Record<string, unknown>): number {
  return typeof input.valueEth === "string" ? parseFloat(input.valueEth) : 0;
}

export const safetySupervisor = {
  /**
   * Approve or veto a proposed tool execution.
   * Throws SupervisorVetoError if the operation should be blocked.
   */
  approve(params: {
    toolName: string;
    input: Record<string, unknown>;
    simulationPassed: boolean;
    sessionId?: string;
  }): void {
    const { toolName, input, simulationPassed, sessionId } = params;

    if (!simulationPassed) {
      throw new SupervisorVetoError(
        "Simulation did not pass — commit blocked",
        { toolName },
      );
    }

    // Spend limit check for sendTransaction (throws SpendLimitError if over).
    if (toolName === "sendTransaction") {
      getTracker(sessionId).validate(valueEthOf(input));
    }
  },

  /** Record a confirmed spend after successful execution. */
  recordSpend(
    toolName: string,
    input: Record<string, unknown>,
    sessionId?: string,
  ): void {
    if (toolName === "sendTransaction") {
      getTracker(sessionId).record(valueEthOf(input));
    }
  },

  /** Read the current session/daily totals for a session (in ETH). */
  getSpend(sessionId?: string): { sessionTotal: number; dailyTotal: number } {
    const tracker = getTracker(sessionId);
    return {
      sessionTotal: tracker.getSessionTotal(),
      dailyTotal: tracker.getDailyTotal(),
    };
  },
};
