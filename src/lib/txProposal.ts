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
