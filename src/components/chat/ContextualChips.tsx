"use client";

import React, { useMemo } from "react";

export type SuggestionChipKind = "prompt" | "send-form" | "gas-form";

export interface SuggestionChip {
  label: string;
  icon: string;
  action: string;
  description?: string;
  kind?: SuggestionChipKind;
  initialAddress?: string;
  initialAmount?: string;
}

/** A tool the assistant actually executed in a message. */
export interface ExecutedTool {
  name: string;
  input?: unknown;
  output?: unknown;
}

export interface ContextualChipsProps {
  tools: ExecutedTool[];
  messageText: string;
  onChipClick: (chip: SuggestionChip) => void;
  disabled?: boolean;
}

/**
 * Map each tool to the follow-up pattern it should surface. `sendTransaction`
 * is intentionally absent — its proposal is handled by the confirm modal, so we
 * never show "send another" mid-flow.
 */
const TOOL_TO_PATTERN: Record<string, string> = {
  getBalance: "balance-checked",
  estimateGas: "gas-estimated",
  getTransactionHistory: "history-viewed",
  resolveAddress: "address-resolved",
  getTokenPrice: "price-checked",
};

function readString(value: unknown, key: string): string | undefined {
  if (value && typeof value === "object" && key in value) {
    const v = (value as Record<string, unknown>)[key];
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

/** Prefer a structured address from the tool over scraping the prose. */
function resolveAddress(tool: ExecutedTool, text: string): string | undefined {
  return (
    readString(tool.output, "address") ??
    readString(tool.input, "to") ??
    readString(tool.input, "address") ??
    text.match(/0x[a-fA-F0-9]{40}/)?.[0]
  );
}

/**
 * Pull the ETH amount out of a tool call so follow-up actions can carry it.
 * The chat-layer `estimateGas` tool takes `value` (a number); the underlying
 * tool uses `valueEth` (a string) — accept either so the send form pre-fills.
 */
function resolveAmount(tool: ExecutedTool): string | undefined {
  if (tool.input && typeof tool.input === "object") {
    const rec = tool.input as Record<string, unknown>;
    if (
      typeof rec.value === "number" &&
      Number.isFinite(rec.value) &&
      rec.value > 0
    ) {
      return String(rec.value);
    }
    const valueEth = readString(tool.input, "valueEth");
    if (valueEth) return valueEth;
  }
  return undefined;
}

/** The last tool whose result has a meaningful follow-up. */
function lastRelevantTool(tools: ExecutedTool[]): ExecutedTool | null {
  for (let i = tools.length - 1; i >= 0; i--) {
    if (TOOL_TO_PATTERN[tools[i].name]) return tools[i];
  }
  return null;
}

function getChipsForPattern(
  pattern: string,
  extractedAddress?: string,
  extractedAmount?: string,
): SuggestionChip[] {
  const chipMap: Record<string, SuggestionChip[]> = {
    "balance-checked": [
      {
        label: "Send ETH",
        icon: "💸",
        action: "I want to send some ETH",
        description: "Transfer ETH to another wallet",
        kind: "send-form",
      },
      {
        label: "Estimate Gas",
        icon: "⛽",
        action: "What would it cost to send 0.1 ETH?",
        description: "Gas fee calculation",
        kind: "gas-form",
        initialAmount: "0.1",
      },
      {
        label: "View History",
        icon: "📜",
        action: "Show my recent transaction history",
        description: "See past transfers",
        kind: "prompt",
      },
    ],
    "gas-estimated": [
      {
        label: "Proceed with Send",
        icon: "✓",
        action: "Go ahead and send the transaction with these fees",
        description: "Confirm and broadcast",
        kind: "send-form",
        initialAddress: extractedAddress,
        initialAmount: extractedAmount,
      },
      {
        label: "Estimate Higher Amount",
        icon: "📊",
        action: "What if I send a larger amount?",
        description: "Different fee calculation",
        kind: "gas-form",
      },
    ],
    "history-viewed": [
      {
        label: "Transaction Details",
        icon: "🔍",
        action: "Show details on one of those transactions",
        description: "Deep dive into history",
        kind: "prompt",
      },
      {
        label: "Check Balance",
        icon: "💰",
        action: "What's my current balance?",
        description: "Refresh wallet balance",
        kind: "prompt",
      },
    ],
    "address-resolved": [
      {
        label: "Send to This",
        icon: "📮",
        action: extractedAddress
          ? `I want to send ETH to ${extractedAddress}`
          : "I want to send ETH to this address",
        description: "Transfer to resolved address",
        kind: "send-form",
        initialAddress: extractedAddress,
      },
      {
        label: "Estimate Gas",
        icon: "⛽",
        action: "Estimate gas to send to this address",
        description: "Gas fee calculation",
        kind: "gas-form",
        initialAddress: extractedAddress,
      },
    ],
    "price-checked": [
      {
        label: "Check Balance",
        icon: "💰",
        action: "What's my current balance?",
        description: "Refresh wallet balance",
        kind: "prompt",
      },
      {
        label: "Send ETH",
        icon: "💸",
        action: "I want to send some ETH",
        description: "Transfer ETH to another wallet",
        kind: "send-form",
      },
    ],
  };

  return chipMap[pattern] || [];
}

export function ContextualChips({
  tools,
  messageText,
  onChipClick,
  disabled = false,
}: ContextualChipsProps) {
  const chips = useMemo(() => {
    const tool = lastRelevantTool(tools);
    if (!tool) return [];
    const pattern = TOOL_TO_PATTERN[tool.name];
    const address = resolveAddress(tool, messageText);
    const amount = resolveAmount(tool);
    return getChipsForPattern(pattern, address, amount);
  }, [tools, messageText]);

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="contextual-chips-container">
      <div className="contextual-chips-label">Quick actions:</div>
      <div className="contextual-chips">
        {chips.map((chip, idx) => (
          <button
            key={idx}
            className="contextual-chip"
            type="button"
            disabled={disabled}
            onClick={() => onChipClick(chip)}
            title={chip.description}
            aria-label={`${chip.label}: ${chip.description}`}
          >
            <span className="chip-icon">{chip.icon}</span>
            <span className="chip-label">{chip.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
