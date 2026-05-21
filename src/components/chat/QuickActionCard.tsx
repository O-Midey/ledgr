"use client";

import { useMemo, useState } from "react";

interface QuickActionCardProps {
  mode: "send" | "gas";
  initialAddress?: string;
  initialAmount?: string;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (prompt: string) => Promise<void> | void;
}

function getCardCopy(mode: "send" | "gas") {
  if (mode === "send") {
    return {
      title: "Send ETH",
      description:
        "Enter the amount and recipient, then I’ll draft the request.",
      submitLabel: "Draft send",
    };
  }

  return {
    title: "Estimate gas",
    description:
      "Enter the transfer details and I’ll estimate the Sepolia fee.",
    submitLabel: "Estimate fee",
  };
}

export function QuickActionCard({
  mode,
  initialAddress,
  initialAmount,
  disabled = false,
  onCancel,
  onSubmit,
}: QuickActionCardProps) {
  const [recipient, setRecipient] = useState(initialAddress ?? "");
  const [amount, setAmount] = useState(initialAmount ?? "");
  const [error, setError] = useState("");

  const copy = useMemo(() => getCardCopy(mode), [mode]);

  const handleSubmit = async () => {
    const trimmedRecipient = recipient.trim();
    const trimmedAmount = amount.trim();
    const parsedAmount = Number(trimmedAmount);

    if (!trimmedRecipient) {
      setError("Enter a recipient address or ENS name.");
      return;
    }

    if (!trimmedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid ETH amount greater than zero.");
      return;
    }

    setError("");

    const prompt =
      mode === "send"
        ? `Send ${trimmedAmount} ETH from my wallet to ${trimmedRecipient} on Sepolia.`
        : `Estimate gas to send ${trimmedAmount} ETH from my wallet to ${trimmedRecipient} on Sepolia.`;

    await onSubmit(prompt);
  };

  return (
    <div className="quick-action-card" role="group" aria-label={copy.title}>
      <div className="quick-action-header">
        <div>
          <div className="quick-action-title">{copy.title}</div>
          <div className="quick-action-sub">{copy.description}</div>
        </div>
        <button
          type="button"
          className="quick-action-dismiss"
          onClick={onCancel}
          disabled={disabled}
          aria-label="Dismiss quick action"
        >
          ✕
        </button>
      </div>

      <div className="quick-action-grid">
        <label className="quick-action-field">
          <span className="quick-action-label">Recipient</span>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x... or vitalik.eth"
            className="quick-action-input"
            disabled={disabled}
          />
        </label>

        <label className="quick-action-field quick-action-field-small">
          <span className="quick-action-label">Amount (ETH)</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={mode === "send" ? "0.05" : "0.1"}
            className="quick-action-input"
            disabled={disabled}
          />
        </label>
      </div>

      {error && <div className="quick-action-error">{error}</div>}

      <div className="quick-action-actions">
        <button
          type="button"
          className="quick-action-btn secondary"
          onClick={onCancel}
          disabled={disabled}
        >
          Cancel
        </button>
        <button
          type="button"
          className="quick-action-btn primary"
          onClick={() => {
            void handleSubmit();
          }}
          disabled={disabled}
        >
          {copy.submitLabel}
        </button>
      </div>
    </div>
  );
}
