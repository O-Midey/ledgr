import type { ExecutionResult } from "@/types/agent";
import {
  StructuredError,
  ValidationError,
  PreconditionError,
} from "@/types/errors";

/**
 * Verifies a proposed tool call before execution.
 * Checks schema validity, preconditions, and simulation results.
 * Returns true if approved, throws StructuredError if not.
 */
export const verifier = {
  /**
   * Validate tool input against its Zod schema.
   * Throws ValidationError with details if invalid.
   */
  validateSchema(
    tool: {
      name: string;
      schema: {
        safeParse: (v: unknown) => {
          success: boolean;
          error?: { format: () => unknown };
        };
      };
    },
    input: unknown,
  ): void {
    const result = tool.schema.safeParse(input);
    if (!result.success) {
      throw new ValidationError(
        `Schema validation failed for tool: ${tool.name}`,
        {
          errors: result.error?.format(),
        },
      );
    }
  },

  /**
   * Verify preconditions for side-effectful tools.
   * e.g., non-zero amount, valid destination, no send-to-self.
   * Throws PreconditionError if violated.
   */
  checkPreconditions(toolName: string, input: Record<string, unknown>): void {
    if (toolName === "sendTransaction") {
      const { valueEth, to, from } = input;

      if (typeof valueEth === "string" && parseFloat(valueEth) <= 0) {
        throw new PreconditionError("Amount must be greater than zero", {
          valueEth,
        });
      }

      if (
        typeof to === "string" &&
        typeof from === "string" &&
        to.toLowerCase() === from.toLowerCase()
      ) {
        throw new PreconditionError("Cannot send ETH to your own address", {
          to,
          from,
        });
      }
    }
  },

  /**
   * Inspect a simulation result and approve or reject.
   */
  approveSimulation(
    toolName: string,
    simulationError: StructuredError | null,
  ): void {
    if (simulationError) {
      throw simulationError;
    }
  },

  /** Approve an execution result post-commit. */
  approveResult(result: ExecutionResult): void {
    void result; // result available for future validation hooks
    // Extensible: add result-level checks here (e.g., receipt status)
  },
};
