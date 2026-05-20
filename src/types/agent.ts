import { z } from "zod";
import type { StructuredError } from "./errors";

// ---- Goal ----

export type IntentType =
  | "GET_BALANCE"
  | "SEND_TRANSACTION"
  | "GET_TRANSACTION_HISTORY"
  | "ESTIMATE_GAS"
  | "GET_TOKEN_PRICE"
  | "RESOLVE_ADDRESS"
  | "UNKNOWN";

export interface GoalIntent {
  readonly id: string;
  readonly raw: string;
  readonly intent: IntentType;
  readonly entities: Record<string, unknown>;
  readonly requiresClarification: boolean;
  readonly clarificationQuestion?: string;
  readonly createdAt: number;
}

// ---- Plan ----

export interface ActionStep {
  readonly stepId: string;
  readonly toolName: string;
  readonly inputSchema: z.ZodTypeAny;
  readonly resolvedInput: Record<string, unknown>;
  readonly dependsOn: string[]; // stepIds
}

export interface ActionPlan {
  readonly planId: string;
  readonly goalId: string;
  readonly steps: ActionStep[];
  readonly createdAt: number;
}

// ---- Tool Call ----

export interface ToolCall {
  readonly callId: string;
  readonly toolName: string;
  readonly input: Record<string, unknown>;
  readonly idempotencyKey?: string;
  readonly sideEffects: boolean;
  readonly createdAt: number;
}

// ---- Execution Result ----

export type ExecutionStatus =
  | "success"
  | "failed"
  | "vetoed"
  | "idempotency_hit"
  | "safe_halt";

export interface ExecutionResult<T = unknown> {
  readonly callId: string;
  readonly toolName: string;
  readonly status: ExecutionStatus;
  readonly output?: T;
  readonly error?: StructuredError;
  readonly simulationPassed: boolean;
  readonly idempotencyKey?: string;
  readonly executedAt: number;
  readonly durationMs: number;
}

// ---- Simulation ----

export interface SimulationResult {
  readonly success: boolean;
  readonly estimatedGas?: bigint;
  readonly revertReason?: string;
  readonly warnings: string[];
}
