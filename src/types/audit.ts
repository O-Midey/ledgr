import type { ErrorCode } from "./errors";
import type { ExecutionStatus } from "./agent";

export type AuditSeverity = "info" | "warn" | "error" | "critical";

export type AuditEventType =
  | "GOAL_RECEIVED"
  | "PLAN_CREATED"
  | "TOOL_CALL_START"
  | "TOOL_CALL_SUCCESS"
  | "TOOL_CALL_FAILED"
  | "SIMULATION_PASSED"
  | "SIMULATION_FAILED"
  | "SUPERVISOR_APPROVED"
  | "SUPERVISOR_VETOED"
  | "IDEMPOTENCY_HIT"
  | "SAFE_HALT"
  | "INJECTION_DETECTED"
  | "SPEND_LIMIT_BREACH"
  | "RATE_LIMIT_HIT"
  | "CIRCUIT_OPENED"
  | "CIRCUIT_CLOSED"
  | "CONTEXT_PRUNED"
  | "STEP_BUDGET_EXCEEDED";

export interface AuditEntry {
  readonly id: string;
  readonly sessionId: string;
  readonly eventType: AuditEventType;
  readonly severity: AuditSeverity;
  readonly timestamp: number;
  /** Tool name if applicable */
  readonly toolName?: string;
  /** Idempotency key if applicable */
  readonly idempotencyKey?: string;
  /** Execution outcome if applicable */
  readonly executionStatus?: ExecutionStatus;
  /** Sanitized context — must not contain secrets */
  readonly context: AuditEntryContext;
  /** SHA-256 hash of (previousHash + this entry content) */
  readonly hash: string;
  /** Hash of the immediately preceding entry */
  readonly previousHash: string;
}

export interface AuditEntryContext {
  errorCode?: ErrorCode;
  errorMessage?: string;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}
