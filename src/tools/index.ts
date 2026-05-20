import { getBalanceTool } from "./getBalance";
import { estimateGasTool } from "./estimateGas";
import { getTransactionHistoryTool } from "./getTransactionHistory";
import { sendTransactionTool } from "./sendTransaction";
import { getTokenPriceTool } from "./getTokenPrice";
import { resolveAddressTool } from "./resolveAddress";
import type { z } from "zod";

export interface ToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: TSchema;
  idempotent: boolean;
  sideEffects: boolean;
  execute: (input: z.infer<TSchema>) => Promise<unknown>;
  simulate?: (input: z.infer<TSchema>) => Promise<void>;
}

export const TOOLS: ToolDefinition[] = [
  getBalanceTool as ToolDefinition,
  estimateGasTool as ToolDefinition,
  getTransactionHistoryTool as ToolDefinition,
  sendTransactionTool as ToolDefinition,
  getTokenPriceTool as ToolDefinition,
  resolveAddressTool as ToolDefinition,
];

export const TOOL_MAP = new Map<string, ToolDefinition>(
  TOOLS.map((t) => [t.name, t]),
);
