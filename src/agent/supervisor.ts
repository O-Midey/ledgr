import { SpendTracker } from "@/security/spendTracker";
import { SupervisorVetoError } from "@/types/errors";

const spendTracker = new SpendTracker();

/**
 * SafetySupervisor — final veto gate before any side-effectful commit.
 * Its decision is final and cannot be overridden.
 */
export const safetySupervisor = {
  spendTracker,

  /**
   * Approve or veto a proposed tool execution.
   * Throws SupervisorVetoError if the operation should be blocked.
   */
  approve(params: {
    toolName: string;
    input: Record<string, unknown>;
    simulationPassed: boolean;
  }): void {
    const { toolName, input, simulationPassed } = params;

    if (!simulationPassed) {
      throw new SupervisorVetoError(
        "Simulation did not pass — commit blocked",
        { toolName },
      );
    }

    // Spend limit check for sendTransaction
    if (toolName === "sendTransaction") {
      const valueEth =
        typeof input.valueEth === "string" ? parseFloat(input.valueEth) : 0;
      // Throws SpendLimitError (a StructuredError) if over limit
      spendTracker.validate(valueEth);
    }
  },

  /** Record a confirmed spend after successful execution. */
  recordSpend(toolName: string, input: Record<string, unknown>): void {
    if (toolName === "sendTransaction") {
      const valueEth =
        typeof input.valueEth === "string" ? parseFloat(input.valueEth) : 0;
      spendTracker.record(valueEth);
    }
  },
};
