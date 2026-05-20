import {
  MAX_SINGLE_TX_ETH,
  MAX_SESSION_ETH,
  MAX_DAILY_ETH,
} from "@/lib/constants";
import { SpendLimitError } from "@/types/errors";
import { nowMs } from "@/lib/utils";

interface SpendEvent {
  readonly amountEth: number;
  readonly timestamp: number;
}

/**
 * Immutable spend tracker — events are append-only.
 * Enforces single-tx, session, and daily limits.
 */
export class SpendTracker {
  private readonly events: SpendEvent[] = [];

  private dailyTotal(): number {
    const oneDayAgo = nowMs() - 1000 * 60 * 60 * 24;
    return this.events
      .filter((e) => e.timestamp >= oneDayAgo)
      .reduce((sum, e) => sum + e.amountEth, 0);
  }

  private sessionTotal(): number {
    return this.events.reduce((sum, e) => sum + e.amountEth, 0);
  }

  /** Validate a proposed spend amount. Throws SpendLimitError if any limit is breached. */
  validate(amountEth: number): void {
    if (amountEth <= 0) {
      throw new SpendLimitError("Amount must be positive", { amountEth });
    }
    if (amountEth > MAX_SINGLE_TX_ETH) {
      throw new SpendLimitError(
        `Single transaction limit is ${MAX_SINGLE_TX_ETH} ETH`,
        { amountEth, limit: MAX_SINGLE_TX_ETH },
      );
    }
    const session = this.sessionTotal();
    if (session + amountEth > MAX_SESSION_ETH) {
      throw new SpendLimitError(
        `Session spend limit of ${MAX_SESSION_ETH} ETH would be exceeded`,
        { amountEth, sessionTotal: session, limit: MAX_SESSION_ETH },
      );
    }
    const daily = this.dailyTotal();
    if (daily + amountEth > MAX_DAILY_ETH) {
      throw new SpendLimitError(
        `Daily spend limit of ${MAX_DAILY_ETH} ETH would be exceeded`,
        { amountEth, dailyTotal: daily, limit: MAX_DAILY_ETH },
      );
    }
  }

  /** Record a confirmed spend. Append-only — never mutates existing events. */
  record(amountEth: number): void {
    this.events.push(Object.freeze({ amountEth, timestamp: nowMs() }));
  }

  getSessionTotal(): number {
    return this.sessionTotal();
  }

  getDailyTotal(): number {
    return this.dailyTotal();
  }
}
