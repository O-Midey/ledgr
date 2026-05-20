import type { ToolCall, ExecutionResult } from "@/types/agent";
import { StructuredError } from "@/types/errors";
import { toolRouter } from "./toolRouter";
import { verifier } from "./verifier";
import { safetySupervisor } from "./supervisor";
import { IdempotencyStore } from "@/lib/idempotency";
import { AuditLog } from "@/audit/auditLog";
import { generateId, nowMs } from "@/lib/utils";

const idempotencyStore = new IdempotencyStore();

/**
 * ExecutionGateway — the ONLY place tools are executed.
 *
 * Enforced order for side-effectful tools:
 * 0. Idempotency check
 * 1. Schema validation
 * 2. Preconditions
 * 3. Simulation
 * 4. Verifier approval
 * 5. SafetySupervisor check
 * 6. Commit execution
 * 7. Audit write
 * 8. Idempotency record
 *
 * Read-only tools skip steps 0, 3, 5, 8.
 */
export class ExecutionGateway {
  constructor(private readonly auditLog: AuditLog) {}

  async execute<T = unknown>(call: ToolCall): Promise<ExecutionResult<T>> {
    const startedAt = nowMs();

    // --- Step 0: Idempotency check (side-effectful only) ---
    if (call.sideEffects && call.idempotencyKey) {
      const cached = idempotencyStore.get(call.idempotencyKey);
      if (cached) {
        await this.auditLog.append({
          eventType: "IDEMPOTENCY_HIT",
          severity: "info",
          toolName: call.toolName,
          idempotencyKey: call.idempotencyKey,
          executionStatus: "idempotency_hit",
          context: { callId: call.callId },
        });
        return { ...(cached as ExecutionResult<T>), status: "idempotency_hit" };
      }
    }

    // --- Resolve tool via router (checks circuit breaker) ---
    let tool: ReturnType<typeof toolRouter.resolve>;
    try {
      tool = toolRouter.resolve(call.toolName);
    } catch (err) {
      return this.buildFailResult<T>(call, err, startedAt, false);
    }

    // --- Step 1: Schema validation ---
    try {
      verifier.validateSchema(tool, call.input);
    } catch (err) {
      await this.auditLog.append({
        eventType: "TOOL_CALL_FAILED",
        severity: "warn",
        toolName: call.toolName,
        executionStatus: "failed",
        context: {
          callId: call.callId,
          step: "schema_validation",
          error: String(err),
        },
      });
      return this.buildFailResult<T>(call, err, startedAt, false);
    }

    // --- Step 2: Preconditions ---
    try {
      verifier.checkPreconditions(call.toolName, call.input);
    } catch (err) {
      await this.auditLog.append({
        eventType: "TOOL_CALL_FAILED",
        severity: "warn",
        toolName: call.toolName,
        executionStatus: "failed",
        context: {
          callId: call.callId,
          step: "preconditions",
          error: String(err),
        },
      });
      return this.buildFailResult<T>(call, err, startedAt, false);
    }

    // --- Step 3: Simulation (side-effectful only) ---
    let simulationPassed = !call.sideEffects; // read-only tools skip simulation
    if (
      call.sideEffects &&
      "simulate" in tool &&
      typeof tool.simulate === "function"
    ) {
      try {
        await tool.simulate(call.input);
        simulationPassed = true;
        await this.auditLog.append({
          eventType: "SIMULATION_PASSED",
          severity: "info",
          toolName: call.toolName,
          context: { callId: call.callId },
        });
      } catch (err) {
        simulationPassed = false;
        await this.auditLog.append({
          eventType: "SIMULATION_FAILED",
          severity: "error",
          toolName: call.toolName,
          executionStatus: "failed",
          context: { callId: call.callId, error: String(err) },
        });
        toolRouter.recordFailure(call.toolName);
        return this.buildFailResult<T>(call, err, startedAt, false);
      }
    }

    // --- Step 4: Verifier approval ---
    try {
      verifier.approveSimulation(call.toolName, null);
    } catch (err) {
      return this.buildFailResult<T>(call, err, startedAt, simulationPassed);
    }

    // --- Step 5: SafetySupervisor (side-effectful only) ---
    if (call.sideEffects) {
      try {
        safetySupervisor.approve({
          toolName: call.toolName,
          input: call.input,
          simulationPassed,
        });
        await this.auditLog.append({
          eventType: "SUPERVISOR_APPROVED",
          severity: "info",
          toolName: call.toolName,
          context: { callId: call.callId },
        });
      } catch (err) {
        await this.auditLog.append({
          eventType: "SUPERVISOR_VETOED",
          severity: "warn",
          toolName: call.toolName,
          executionStatus: "vetoed",
          context: { callId: call.callId, error: String(err) },
        });
        return this.buildVetoResult<T>(call, err, startedAt, simulationPassed);
      }
    }

    // --- Step 6: Commit execution ---
    await this.auditLog.append({
      eventType: "TOOL_CALL_START",
      severity: "info",
      toolName: call.toolName,
      idempotencyKey: call.idempotencyKey,
      context: { callId: call.callId },
    });

    let output: T;
    try {
      output = (await tool.execute(call.input)) as T;
    } catch (err) {
      toolRouter.recordFailure(call.toolName);
      await this.auditLog.append({
        eventType: "TOOL_CALL_FAILED",
        severity: "error",
        toolName: call.toolName,
        executionStatus: "failed",
        context: { callId: call.callId, step: "execute", error: String(err) },
      });
      return this.buildFailResult<T>(call, err, startedAt, simulationPassed);
    }

    toolRouter.recordSuccess(call.toolName);

    const result: ExecutionResult<T> = {
      callId: call.callId,
      toolName: call.toolName,
      status: "success",
      output,
      simulationPassed,
      idempotencyKey: call.idempotencyKey,
      executedAt: startedAt,
      durationMs: nowMs() - startedAt,
    };

    // --- Step 7: Audit success ---
    await this.auditLog.append({
      eventType: "TOOL_CALL_SUCCESS",
      severity: "info",
      toolName: call.toolName,
      idempotencyKey: call.idempotencyKey,
      executionStatus: "success",
      context: { callId: call.callId, durationMs: result.durationMs },
    });

    verifier.approveResult(result);

    // Record spend for supervisor tracking
    if (call.sideEffects) {
      safetySupervisor.recordSpend(call.toolName, call.input);
    }

    // --- Step 8: Idempotency record ---
    if (call.sideEffects && call.idempotencyKey) {
      idempotencyStore.set(call.idempotencyKey, result);
    }

    return result;
  }

  private buildFailResult<T>(
    call: ToolCall,
    err: unknown,
    startedAt: number,
    simulationPassed: boolean,
  ): ExecutionResult<T> {
    const error =
      err instanceof StructuredError
        ? err
        : new StructuredError("TOOL_EXECUTION_FAILED", String(err));

    return {
      callId: call.callId,
      toolName: call.toolName,
      status: "failed",
      error,
      simulationPassed,
      idempotencyKey: call.idempotencyKey,
      executedAt: startedAt,
      durationMs: nowMs() - startedAt,
    };
  }

  private buildVetoResult<T>(
    call: ToolCall,
    err: unknown,
    startedAt: number,
    simulationPassed: boolean,
  ): ExecutionResult<T> {
    const error =
      err instanceof StructuredError
        ? err
        : new StructuredError("SUPERVISOR_VETO", String(err));

    return {
      callId: call.callId,
      toolName: call.toolName,
      status: "vetoed",
      error,
      simulationPassed,
      idempotencyKey: call.idempotencyKey,
      executedAt: startedAt,
      durationMs: nowMs() - startedAt,
    };
  }
}

/** Build a ToolCall object for use with ExecutionGateway. */
export function buildToolCall(params: {
  toolName: string;
  input: Record<string, unknown>;
  sideEffects: boolean;
  idempotencyKey?: string;
}): ToolCall {
  return {
    callId: generateId(),
    toolName: params.toolName,
    input: params.input,
    sideEffects: params.sideEffects,
    idempotencyKey: params.idempotencyKey,
    createdAt: nowMs(),
  };
}
