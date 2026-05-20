import { IDEMPOTENCY_TTL_MS } from "@/lib/constants";
import type { ExecutionResult } from "@/types/agent";

interface IdempotencyRecord {
  readonly key: string;
  readonly result: ExecutionResult;
  readonly createdAt: number;
}

/**
 * Append-only idempotency store.
 * A stored key can never be overwritten — only expired entries are evicted.
 */
export class IdempotencyStore {
  private readonly store = new Map<string, IdempotencyRecord>();

  /** Returns existing result if key exists and is not expired. */
  get(key: string): ExecutionResult | null {
    const record = this.store.get(key);
    if (!record) return null;
    if (Date.now() - record.createdAt > IDEMPOTENCY_TTL_MS) {
      this.store.delete(key);
      return null;
    }
    return record.result;
  }

  /**
   * Store a result for a key.
   * Throws if the key already exists (unexpired) — never overwrites.
   */
  set(key: string, result: ExecutionResult): void {
    const existing = this.get(key);
    if (existing !== null) {
      throw new Error(`Idempotency key already exists: ${key}`);
    }
    this.store.set(key, {
      key,
      result,
      createdAt: Date.now(),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }
}
