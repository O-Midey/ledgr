export interface TxProposal {
  to: string;
  valueEth: string;
  from: string;
  idempotencyKey: string;
  memo?: string;
  callId: string;
}

export function isTxProposalOutput(output: unknown): output is {
  pendingConfirmation: true;
  proposal: TxProposal;
} {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  return o.pendingConfirmation === true && typeof o.proposal === "object" && o.proposal !== null;
}

/**
 * Shape a `sendTransaction` tool result takes once the user dismisses its
 * confirmation modal. Replacing the original `pendingConfirmation: true` output
 * with this serves three purposes at once:
 *  - the confirm modal can't re-surface (it's no longer a pending proposal),
 *  - the inline preview can render a clear "cancelled" state, and
 *  - the model sees the resolution of its own tool call on the next turn,
 *    instead of a proposal that looks perpetually awaiting confirmation.
 */
export interface CancelledTxProposalOutput {
  pendingConfirmation: false;
  cancelled: true;
  proposal: TxProposal;
}

export function isCancelledProposalOutput(
  output: unknown,
): output is CancelledTxProposalOutput {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  return (
    o.cancelled === true &&
    typeof o.proposal === "object" &&
    o.proposal !== null
  );
}

export function buildCancelledProposalOutput(
  proposal: TxProposal,
): CancelledTxProposalOutput {
  return { pendingConfirmation: false, cancelled: true, proposal };
}

/**
 * Shape a `sendTransaction` tool result takes once its transaction has settled
 * on-chain (confirmed, reverted, or its confirmation could not be verified).
 *
 * Like the cancelled output, replacing the original `pendingConfirmation: true`
 * output with this resolves the tool call so the model stops treating the
 * transaction as perpetually awaiting confirmation — without it the assistant
 * keeps insisting it has "already initiated" the same transfer. The `note`
 * field spells out the resolution in plain language for the model.
 */
export interface SettledTxProposalOutput {
  pendingConfirmation: false;
  settled: true;
  status: "confirmed" | "reverted" | "failed";
  hash: string;
  proposal: TxProposal;
  blockNumber?: string;
  txFeeEth?: string;
  note: string;
}

export function isSettledProposalOutput(
  output: unknown,
): output is SettledTxProposalOutput {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  return (
    o.settled === true &&
    (o.status === "confirmed" ||
      o.status === "reverted" ||
      o.status === "failed") &&
    typeof o.proposal === "object" &&
    o.proposal !== null
  );
}

export function buildSettledProposalOutput(
  proposal: TxProposal,
  settlement: {
    status: "confirmed" | "reverted" | "failed";
    hash: string;
    blockNumber?: string;
    txFeeEth?: string;
  },
): SettledTxProposalOutput {
  const note =
    settlement.status === "confirmed"
      ? `Transaction confirmed on-chain (hash ${settlement.hash}). The transfer of ${proposal.valueEth} ETH to ${proposal.to} is complete — do not propose or resend it.`
      : settlement.status === "reverted"
        ? `Transaction reverted on-chain (hash ${settlement.hash}); the transfer did not succeed and no ETH was sent. You may offer to try again.`
        : `Transaction confirmation could not be verified (hash ${settlement.hash}). Point the user to the block explorer for the latest status before retrying.`;

  return {
    pendingConfirmation: false,
    settled: true,
    status: settlement.status,
    hash: settlement.hash,
    proposal,
    blockNumber: settlement.blockNumber,
    txFeeEth: settlement.txFeeEth,
    note,
  };
}
