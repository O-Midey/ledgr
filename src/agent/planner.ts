import type { GoalIntent, ActionPlan, ActionStep } from "@/types/agent";
import { TOOL_MAP } from "@/tools/index";
import { generateId, nowMs } from "@/lib/utils";
import { StructuredError } from "@/types/errors";

/**
 * Translates a GoalIntent into an ActionPlan.
 * In the AI-driven flow, the LLM selects tools dynamically via the Vercel AI SDK.
 * This planner handles deterministic single-step plans for known intents,
 * and produces a plan skeleton the ExecutionGateway can execute.
 */
export function buildPlan(
  goal: GoalIntent,
  toolInput: Record<string, unknown>,
): ActionPlan {
  const toolName = intentToToolName(goal.intent);

  if (!toolName) {
    throw new StructuredError(
      "TOOL_NOT_FOUND",
      `No tool available for intent: ${goal.intent}`,
      { intent: goal.intent },
    );
  }

  const tool = TOOL_MAP.get(toolName);
  if (!tool) {
    throw new StructuredError(
      "TOOL_NOT_FOUND",
      `Tool not registered: ${toolName}`,
      { toolName },
    );
  }

  const step: ActionStep = {
    stepId: generateId(),
    toolName,
    inputSchema: tool.schema,
    resolvedInput: toolInput,
    dependsOn: [],
  };

  return {
    planId: generateId(),
    goalId: goal.id,
    steps: [step],
    createdAt: nowMs(),
  };
}

function intentToToolName(intent: string): string | null {
  const map: Record<string, string> = {
    GET_BALANCE: "getBalance",
    SEND_TRANSACTION: "sendTransaction",
    GET_TRANSACTION_HISTORY: "getTransactionHistory",
    ESTIMATE_GAS: "estimateGas",
    GET_TOKEN_PRICE: "getTokenPrice",
    RESOLVE_ADDRESS: "resolveAddress",
  };
  return map[intent] ?? null;
}
