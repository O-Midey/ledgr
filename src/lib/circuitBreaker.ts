import {
  CIRCUIT_FAILURE_THRESHOLD,
  CIRCUIT_RESET_TIMEOUT_MS,
} from "@/lib/constants";
import { CircuitOpenError } from "@/types/errors";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface BreakerRecord {
  state: CircuitState;
  failures: number;
  openedAt: number | null;
}

/**
 * Per-tool circuit breaker.
 * CLOSED → normal operation.
 * OPEN → fail fast after threshold failures.
 * HALF_OPEN → allow one probe request.
 */
export class CircuitBreaker {
  private readonly breakers = new Map<string, BreakerRecord>();

  private getOrCreate(toolName: string): BreakerRecord {
    if (!this.breakers.has(toolName)) {
      this.breakers.set(toolName, {
        state: "CLOSED",
        failures: 0,
        openedAt: null,
      });
    }
    return this.breakers.get(toolName)!;
  }

  /** Throws CircuitOpenError if the breaker is OPEN and not ready to probe. */
  check(toolName: string): void {
    const record = this.getOrCreate(toolName);

    if (record.state === "OPEN") {
      const elapsed = Date.now() - (record.openedAt ?? 0);
      if (elapsed >= CIRCUIT_RESET_TIMEOUT_MS) {
        record.state = "HALF_OPEN";
      } else {
        throw new CircuitOpenError(toolName);
      }
    }
  }

  recordSuccess(toolName: string): void {
    const record = this.getOrCreate(toolName);
    record.failures = 0;
    record.state = "CLOSED";
    record.openedAt = null;
  }

  recordFailure(toolName: string): void {
    const record = this.getOrCreate(toolName);
    record.failures += 1;

    if (
      record.state === "HALF_OPEN" ||
      record.failures >= CIRCUIT_FAILURE_THRESHOLD
    ) {
      record.state = "OPEN";
      record.openedAt = Date.now();
    }
  }

  getState(toolName: string): CircuitState {
    return this.getOrCreate(toolName).state;
  }
}
