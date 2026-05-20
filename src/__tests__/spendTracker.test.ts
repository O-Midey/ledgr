import { describe, it, expect } from "vitest";
import { SpendTracker } from "@/security/spendTracker";
import { SpendLimitError } from "@/types/errors";

describe("SpendTracker", () => {
  it("allows a spend within all limits", () => {
    const tracker = new SpendTracker();
    expect(() => tracker.validate(0.05)).not.toThrow();
    tracker.record(0.05);
  });

  it("blocks a single transaction over the max single-tx limit", () => {
    const tracker = new SpendTracker();
    expect(() => tracker.validate(0.2)).toThrow(SpendLimitError);
  });

  it("blocks when cumulative session spend exceeds session limit", () => {
    const tracker = new SpendTracker();
    for (let i = 0; i < 5; i++) {
      tracker.validate(0.1);
      tracker.record(0.1);
    }
    // Next one should push us over 0.5 ETH session limit
    expect(() => tracker.validate(0.1)).toThrow(SpendLimitError);
  });

  it("returns current totals", () => {
    const tracker = new SpendTracker();
    tracker.validate(0.05);
    tracker.record(0.05);
    expect(tracker.getSessionTotal()).toBeCloseTo(0.05);
  });

  it("allows spending after reset (new session)", () => {
    const tracker = new SpendTracker();
    for (let i = 0; i < 5; i++) {
      tracker.validate(0.1);
      tracker.record(0.1);
    }
    // Now over session limit — new tracker simulates new session
    const newSession = new SpendTracker();
    expect(() => newSession.validate(0.1)).not.toThrow();
  });
});
