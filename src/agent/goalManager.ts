import type { GoalIntent, IntentType } from "@/types/agent";
import { generateId, nowMs } from "@/lib/utils";

interface ParsedGoal {
  intent: IntentType;
  entities: Record<string, unknown>;
  requiresClarification: boolean;
  clarificationQuestion?: string;
}

/**
 * Derives a structured GoalIntent from raw user input.
 * Lightweight heuristic classification — the LLM does the heavy lifting
 * via tool selection in the Planner. This layer identifies obvious cases
 * to short-circuit and flag ambiguities.
 */
export function classifyGoal(raw: string): ParsedGoal {
  const lower = raw.toLowerCase();

  if (/\b(balance|how much|funds)\b/.test(lower)) {
    return {
      intent: "GET_BALANCE",
      entities: {},
      requiresClarification: false,
    };
  }
  if (/\b(send|transfer|pay)\b/.test(lower)) {
    return {
      intent: "SEND_TRANSACTION",
      entities: {},
      requiresClarification: false,
    };
  }
  if (/\b(history|transactions?|past|recent)\b/.test(lower)) {
    return {
      intent: "GET_TRANSACTION_HISTORY",
      entities: {},
      requiresClarification: false,
    };
  }
  if (/\b(gas|fee|cost)\b/.test(lower)) {
    return {
      intent: "ESTIMATE_GAS",
      entities: {},
      requiresClarification: false,
    };
  }
  if (/\b(price|worth|value|usd|eur)\b/.test(lower)) {
    return {
      intent: "GET_TOKEN_PRICE",
      entities: {},
      requiresClarification: false,
    };
  }
  if (/\b(who\s+is|address\s+of|resolve)\b/.test(lower)) {
    return {
      intent: "RESOLVE_ADDRESS",
      entities: {},
      requiresClarification: false,
    };
  }

  return {
    intent: "UNKNOWN",
    entities: {},
    requiresClarification: true,
    clarificationQuestion:
      "Could you clarify what you'd like to do? For example: check balance, send ETH, or view transaction history.",
  };
}

export function createGoalIntent(raw: string): GoalIntent {
  const parsed = classifyGoal(raw);
  return {
    id: generateId(),
    raw,
    intent: parsed.intent,
    entities: parsed.entities,
    requiresClarification: parsed.requiresClarification,
    clarificationQuestion: parsed.clarificationQuestion,
    createdAt: nowMs(),
  };
}
