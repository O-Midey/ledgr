import type {
  AuditEntry,
  AuditEventType,
  AuditEntryContext,
  AuditSeverity,
} from "@/types/audit";
import type { ExecutionStatus } from "@/types/agent";
import { GENESIS_HASH } from "@/lib/constants";
import { generateId, nowMs } from "@/lib/utils";
import { recordAuditEntry, getLastAuditHash } from "./sessionStore";

/** Canonical, serializable subset of an entry that the hash commits to. */
interface HashableEntry {
  sessionId: string;
  eventType: string;
  timestamp: number;
  toolName?: string;
  context: unknown;
  previousHash: string;
}

/**
 * Compute the SHA-256 hash for an audit entry. This is the single source of
 * truth for hashing — both writing (AuditLog.append) and verification recompute
 * from the exact same fields, so a stored entry is independently verifiable.
 */
export async function computeAuditHash(entry: HashableEntry): Promise<string> {
  const base = JSON.stringify({
    sessionId: entry.sessionId,
    eventType: entry.eventType,
    timestamp: entry.timestamp,
    toolName: entry.toolName ?? null,
    context: entry.context,
    previousHash: entry.previousHash,
  });

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(base),
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Recompute and compare a single entry's hash. */
export async function verifyAuditEntry(entry: AuditEntry): Promise<boolean> {
  const recomputed = await computeAuditHash({
    sessionId: entry.sessionId,
    eventType: entry.eventType,
    timestamp: entry.timestamp,
    toolName: entry.toolName,
    context: entry.context,
    previousHash: entry.previousHash,
  });
  return recomputed === entry.hash;
}

/**
 * Verify an ordered list of audit entries forms an intact hash chain:
 * each entry links to the previous hash AND its own hash recomputes correctly.
 */
export async function verifyAuditChain(
  entries: readonly AuditEntry[],
): Promise<boolean> {
  let prevHash = GENESIS_HASH;
  for (const entry of entries) {
    if (entry.previousHash !== prevHash) return false;
    if (!(await verifyAuditEntry(entry))) return false;
    prevHash = entry.hash;
  }
  return true;
}

/**
 * Append-only, hash-chained audit log.
 * Entries are immutable once written — no update/delete paths exist.
 *
 * The chain is seeded from the last persisted entry for the session, so it
 * stays continuous across requests rather than restarting at genesis each time.
 */
export class AuditLog {
  private readonly entries: AuditEntry[] = [];
  private readonly initialHash: string;
  private lastHash: string;

  constructor(
    private readonly sessionId: string,
    private readonly walletAddress: string | null = null,
  ) {
    this.initialHash = getLastAuditHash(sessionId);
    this.lastHash = this.initialHash;
  }

  async append(params: {
    eventType: AuditEventType;
    severity: AuditSeverity;
    toolName?: string;
    idempotencyKey?: string;
    executionStatus?: ExecutionStatus;
    context: AuditEntryContext;
  }): Promise<AuditEntry> {
    // Compute the timestamp ONCE so the stored value matches the hashed value.
    const timestamp = nowMs();
    const previousHash = this.lastHash;
    const context = {
      ...params.context,
      walletAddress: this.walletAddress,
    };

    const hash = await computeAuditHash({
      sessionId: this.sessionId,
      eventType: params.eventType,
      timestamp,
      toolName: params.toolName,
      context,
      previousHash,
    });

    const entry: AuditEntry = {
      id: generateId(),
      sessionId: this.sessionId,
      eventType: params.eventType,
      severity: params.severity,
      timestamp,
      toolName: params.toolName,
      idempotencyKey: params.idempotencyKey,
      executionStatus: params.executionStatus,
      context,
      hash,
      previousHash,
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

  /** Verify the entries written by THIS instance link from their seed hash. */
  verifyChain(): boolean {
    let prevHash = this.initialHash;
    for (const entry of this.entries) {
      if (entry.previousHash !== prevHash) return false;
      prevHash = entry.hash;
    }
    return true;
  }
}
