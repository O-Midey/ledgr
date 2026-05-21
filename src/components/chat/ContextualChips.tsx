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

export interface ContextualChipsProps {
  messageText: string;
  onChipClick: (chip: SuggestionChip) => void;
  disabled?: boolean;
}

function extractAddress(text: string): string | undefined {
  return text.match(/0x[a-fA-F0-9]{40}/)?.[0];
}

// Pattern detection for different response types
function detectResponsePattern(text: string): string | null {
  const lowerText = text.toLowerCase();

  // Transaction submitted/confirmed
  if (
    lowerText.includes("submitted") ||
    lowerText.includes("confirmed") ||
    lowerText.includes("hash") ||
    lowerText.includes("0x")
  ) {
    return "transaction-completed";
  }

  // Balance check
  if (
    lowerText.includes("balance") ||
    lowerText.includes("eth") ||
    lowerText.includes("sepolia")
  ) {
    return "balance-checked";
  }

  // Gas estimation
  if (
    lowerText.includes("gas") ||
    lowerText.includes("fee") ||
    lowerText.includes("cost")
  ) {
    return "gas-estimated";
  }

  // Transaction history
  if (
    lowerText.includes("transaction") ||
    lowerText.includes("transfer") ||
    lowerText.includes("history") ||
    lowerText.includes("recent")
  ) {
    return "history-viewed";
  }

  // Address resolution
  if (
    lowerText.includes("address") ||
    lowerText.includes("resolved") ||
    lowerText.includes("ens")
  ) {
    return "address-resolved";
  }

  return null;
}

function getChipsForPattern(
  pattern: string,
  extractedAddress?: string,
): SuggestionChip[] {
  const chipMap: Record<string, SuggestionChip[]> = {
    "transaction-completed": [
      {
        label: "View Receipt",
        icon: "📋",
        action: "Show me the transaction details and receipt",
        description: "Full transaction breakdown",
        kind: "prompt",
      },
      {
        label: "Track Status",
        icon: "📡",
        action: "Monitor this transaction on Sepolia explorer",
        description: "Real-time confirmation",
        kind: "prompt",
      },
      {
        label: "Send Another",
        icon: "📤",
        action: "I want to send another transaction",
        description: "Send ETH to another address",
        kind: "send-form",
      },
    ],
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
        action: "I want to send ETH to this address",
        description: "Transfer to resolved address",
        kind: "send-form",
        initialAddress: extractedAddress,
      },
      {
        label: "Save as Alias",
        icon: "⭐",
        action: "Save this address for later use",
        description: "Add to address book",
        kind: "prompt",
      },
    ],
  };

  return chipMap[pattern] || [];
}

export function ContextualChips({
  messageText,
  onChipClick,
  disabled = false,
}: ContextualChipsProps) {
  const extractedAddress = useMemo(
    () => extractAddress(messageText),
    [messageText],
  );

  const chips = useMemo(() => {
    const pattern = detectResponsePattern(messageText);
    if (!pattern) return [];
    return getChipsForPattern(pattern, extractedAddress);
  }, [messageText, extractedAddress]);

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
