import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IdempotencyStore } from "@/lib/idempotency";
import type { ExecutionResult } from "@/types/agent";

function makeResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    callId: "test-call-id",
    toolName: "testTool",
    status: "success",
    simulationPassed: false,
    executedAt: Date.now(),
    durationMs: 0,
    ...overrides,
  };
}

describe("IdempotencyStore", () => {
  let store: IdempotencyStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new IdempotencyStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for unknown key", () => {
    expect(store.get("unknown")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    const r = makeResult();
    store.set("key1", r);
    expect(store.get("key1")).toEqual(r);
  });

  it("throws when trying to overwrite an existing entry", () => {
    const first = makeResult({ callId: "first" });
    const second = makeResult({ callId: "second" });
    store.set("key1", first);
    expect(() => store.set("key1", second)).toThrow(
      "Idempotency key already exists: key1",
    );
    expect(store.get("key1")).toEqual(first);
  });

  it("returns undefined after TTL expires", () => {
    store.set("key1", makeResult());
    vi.advanceTimersByTime(3601 * 1000); // past 1 hour TTL
    expect(store.get("key1")).toBeNull();
  });

  it("returns value before TTL expires", () => {
    const r = makeResult();
    store.set("key1", r);
    vi.advanceTimersByTime(3599 * 1000); // just before TTL
    expect(store.get("key1")).toEqual(r);
  });

  it("has() returns true for live key", () => {
    store.set("key1", makeResult());
    expect(store.has("key1")).toBe(true);
  });

  it("has() returns false after TTL", () => {
    store.set("key1", makeResult());
    vi.advanceTimersByTime(3601 * 1000);
    expect(store.has("key1")).toBe(false);
  });
});
