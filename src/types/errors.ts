// Typed error hierarchy — never throw raw strings or generic Error for business logic

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "PRECONDITION_FAILED"
  | "SIMULATION_FAILED"
  | "SUPERVISOR_VETO"
  | "IDEMPOTENCY_CONFLICT"
  | "CIRCUIT_OPEN"
  | "TOOL_EXECUTION_FAILED"
  | "INSUFFICIENT_BALANCE"
  | "SPEND_LIMIT_EXCEEDED"
  | "RATE_LIMITED"
  | "INJECTION_DETECTED"
  | "NETWORK_MISMATCH"
  | "ADDRESS_INVALID"
  | "SEND_TO_SELF"
  | "ZERO_AMOUNT"
  | "UNKNOWN_ADDRESS"
  | "AMBIGUOUS_INTENT"
  | "TOOL_NOT_FOUND"
  | "SCHEMA_VIOLATION"
  | "CONTEXT_OVERFLOW"
  | "STEP_BUDGET_EXCEEDED"
  | "BLOCKCHAIN_ERROR"
  | "INTERNAL_ERROR";

export interface StructuredErrorContext {
  [key: string]: unknown;
}

export class StructuredError extends Error {
  readonly code: ErrorCode;
  readonly context: StructuredErrorContext;

  constructor(
    code: ErrorCode,
    message: string,
    context: StructuredErrorContext = {},
  ) {
    super(message);
    this.name = "StructuredError";
    this.code = code;
    this.context = context;
  }
}

export class ValidationError extends StructuredError {
  constructor(message: string, context?: StructuredErrorContext) {
    super("VALIDATION_ERROR", message, context);
    this.name = "ValidationError";
  }
}

export class PreconditionError extends StructuredError {
  constructor(message: string, context?: StructuredErrorContext) {
    super("PRECONDITION_FAILED", message, context);
    this.name = "PreconditionError";
  }
}

export class SimulationError extends StructuredError {
  constructor(message: string, context?: StructuredErrorContext) {
    super("SIMULATION_FAILED", message, context);
    this.name = "SimulationError";
  }
}

export class SupervisorVetoError extends StructuredError {
  constructor(message: string, context?: StructuredErrorContext) {
    super("SUPERVISOR_VETO", message, context);
    this.name = "SupervisorVetoError";
  }
}

export class IdempotencyConflictError extends StructuredError {
  constructor(message: string, context?: StructuredErrorContext) {
    super("IDEMPOTENCY_CONFLICT", message, context);
    this.name = "IdempotencyConflictError";
  }
}

export class CircuitOpenError extends StructuredError {
  constructor(toolName: string) {
    super("CIRCUIT_OPEN", `Circuit breaker is OPEN for tool: ${toolName}`, {
      toolName,
    });
    this.name = "CircuitOpenError";
  }
}

export class SpendLimitError extends StructuredError {
  constructor(message: string, context?: StructuredErrorContext) {
    super("SPEND_LIMIT_EXCEEDED", message, context);
    this.name = "SpendLimitError";
  }
}

export class NetworkMismatchError extends StructuredError {
  constructor(expected: number, actual: number) {
    super("NETWORK_MISMATCH", `Expected chain ${expected}, got ${actual}`, {
      expected,
      actual,
    });
    this.name = "NetworkMismatchError";
  }
}

export class InjectionDetectedError extends StructuredError {
  constructor(pattern: string) {
    super("INJECTION_DETECTED", "Potential prompt injection detected", {
      pattern,
    });
    this.name = "InjectionDetectedError";
  }
}
