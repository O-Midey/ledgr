import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExecutionGateway, buildToolCall } from "@/agent/executionGateway";
import { AuditLog } from "@/audit/auditLog";
import { SupervisorVetoError } from "@/types/errors";

// Mock the tool router so we can test gateway in isolation
vi.mock("@/agent/toolRouter", () => {
  const mockTool = {
    name: "getBalance",
    description: "test",
    schema: { parse: (x: unknown) => x },
    idempotent: true,
    sideEffects: false,
    execute: vi.fn().mockResolvedValue({ balance: "1.0" }),
  };
  return {
    toolRouter: {
      resolve: vi.fn().mockReturnValue(mockTool),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
    },
  };
});

vi.mock("@/agent/verifier", () => ({
  verifier: {
    validateSchema: vi.fn(),
    checkPreconditions: vi.fn(),
    approveSimulation: vi.fn(),
    approveResult: vi.fn(),
  },
}));

vi.mock("@/agent/supervisor", () => ({
  safetySupervisor: {
    approve: vi.fn(),
    recordSpend: vi.fn(),
  },
}));

describe("ExecutionGateway", () => {
  let gateway: ExecutionGateway;
  let auditLog: AuditLog;

  beforeEach(() => {
    vi.clearAllMocks();
    auditLog = new AuditLog("test-session");
    gateway = new ExecutionGateway(auditLog);
  });

  it("executes a read-only tool successfully", async () => {
    const tc = buildToolCall({
      toolName: "getBalance",
      input: { address: "0xabc" },
      sideEffects: false,
    });
    const result = await gateway.execute(tc);
    expect(result.status).toBe("success");
    expect(result.output).toEqual({ balance: "1.0" });
  });

  it("blocks execution when schema validation fails", async () => {
    const { verifier } = await import("@/agent/verifier");
    vi.mocked(verifier.validateSchema).mockImplementationOnce(() => {
      throw new Error("Schema validation failed");
    });

    const tc = buildToolCall({
      toolName: "getBalance",
      input: {},
      sideEffects: false,
    });
    const result = await gateway.execute(tc);
    expect(result.status).toBe("failed");
    expect(result.output).toBeUndefined();
  });

  it("returns idempotency hit without re-executing", async () => {
    const tc = buildToolCall({
      toolName: "sendTransaction",
      input: { to: "0xabc", value: 0.01 },
      sideEffects: true,
      idempotencyKey: "test-idem-key-123",
    });

    // First execution
    await gateway.execute(tc);

    // Reset mock to verify it's not called again
    const { toolRouter: tr } = await import("@/agent/toolRouter");
    vi.mocked(tr.resolve).mockClear();

    // Second execution with same key
    const result2 = await gateway.execute(tc);
    // Should be idempotency_hit
    expect(result2.status).toBe("idempotency_hit");
  });

  it("returns failed result when supervisor vetoes", async () => {
    const { safetySupervisor } = await import("@/agent/supervisor");
    vi.mocked(safetySupervisor.approve).mockImplementationOnce(() => {
      throw new SupervisorVetoError("Veto!", {});
    });

    const { toolRouter: tr } = await import("@/agent/toolRouter");
    const mockTool = {
      name: "sendTransaction",
      description: "test",
      schema: { parse: (x: unknown) => x },
      idempotent: false,
      sideEffects: true,
      simulate: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(tr.resolve).mockReturnValueOnce(mockTool as never);

    const tc = buildToolCall({
      toolName: "sendTransaction",
      input: { to: "0xabc", value: 0.01 },
      sideEffects: true,
      idempotencyKey: "unique-veto-key-456",
    });

    const result = await gateway.execute(tc);
    expect(result.status).toBe("vetoed");
  });

  it("audits each execution attempt", async () => {
    const appendSpy = vi.spyOn(auditLog, "append");
    const tc = buildToolCall({
      toolName: "getBalance",
      input: { address: "0xabc" },
      sideEffects: false,
    });
    await gateway.execute(tc);
    expect(appendSpy).toHaveBeenCalled();
  });
});
