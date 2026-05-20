import { TOOL_MAP } from "@/tools/index";
import { CircuitBreaker } from "@/lib/circuitBreaker";
import { StructuredError } from "@/types/errors";

const breaker = new CircuitBreaker();

/**
 * Routes a tool call to the registered tool definition.
 * Checks the circuit breaker before routing.
 * Reports success/failure back to the breaker after execution.
 */
export const toolRouter = {
  circuitBreaker: breaker,

  resolve(toolName: string) {
    // Check circuit breaker first — throws CircuitOpenError if OPEN
    breaker.check(toolName);

    const tool = TOOL_MAP.get(toolName);
    if (!tool) {
      throw new StructuredError("TOOL_NOT_FOUND", `Unknown tool: ${toolName}`, {
        toolName,
      });
    }
    return tool;
  },

  recordSuccess(toolName: string) {
    breaker.recordSuccess(toolName);
  },

  recordFailure(toolName: string) {
    breaker.recordFailure(toolName);
  },
};
