import type {
  AuditEntry,
  AuditEventType,
  AuditEntryContext,
  AuditSeverity,
} from "@/types/audit";
import type { ExecutionStatus } from "@/types/agent";
import { GENESIS_HASH } from "@/lib/constants";
import { generateId, nowMs } from "@/lib/utils";
import { recordAuditEntry } from "./sessionStore";

/**
 * Append-only, hash-chained audit log.
 * Entries are immutable once written — no update/delete paths exist.
 */
export class AuditLog {
  private readonly entries: AuditEntry[] = [];
  private lastHash: string = GENESIS_HASH;

  constructor(
    private readonly sessionId: string,
    private readonly walletAddress: string | null = null,
  ) {}

  async append(params: {
    eventType: AuditEventType;
    severity: AuditSeverity;
    toolName?: string;
    idempotencyKey?: string;
    executionStatus?: ExecutionStatus;
    context: AuditEntryContext;
  }): Promise<AuditEntry> {
    const base = JSON.stringify({
      sessionId: this.sessionId,
      walletAddress: this.walletAddress,
      eventType: params.eventType,
      timestamp: nowMs(),
      toolName: params.toolName,
      context: params.context,
      previousHash: this.lastHash,
    });

    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(base),
    );
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const entry: AuditEntry = {
      id: generateId(),
      sessionId: this.sessionId,
      eventType: params.eventType,
      severity: params.severity,
      timestamp: nowMs(),
      toolName: params.toolName,
      idempotencyKey: params.idempotencyKey,
      executionStatus: params.executionStatus,
      context: {
        ...params.context,
        walletAddress: this.walletAddress,
      },
      hash,
      previousHash: this.lastHash,
    };

    // Object.freeze ensures the entry is immutable at runtime
    Object.freeze(entry);
    this.entries.push(entry);
    this.lastHash = hash;
    recordAuditEntry(this.sessionId, entry);

    return entry;
  }

  getEntries(): readonly AuditEntry[] {
    return this.entries;
  }

  verifyChain(): boolean {
    let prevHash = GENESIS_HASH;
    for (const entry of this.entries) {
      if (entry.previousHash !== prevHash) return false;
      prevHash = entry.hash;
    }
    return true;
  }
}
