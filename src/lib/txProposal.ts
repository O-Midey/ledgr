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
