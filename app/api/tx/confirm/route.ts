import { z } from "zod";
import { getAddress, parseEther } from "viem";
import { safetySupervisor } from "@/agent/supervisor";
import { AuditLog } from "@/audit/auditLog";
import { getAuditEntries } from "@/audit/sessionStore";
import { publicClient } from "@/wallet/blockchainClient";

/**
 * Records a user-signed transaction after it has been broadcast client-side.
 *
 * This endpoint is untrusted: the client supplies the hash/to/value. To prevent
 * forged audit entries and spend-budget inflation, every claim is verified
 * against the chain before anything is recorded, and duplicate hashes are
 * ignored idempotently.
 */
const confirmSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  hash: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash"),
  to: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid address"),
  valueEth: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Invalid ETH amount"),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { sessionId, hash, to, valueEth, idempotencyKey } = parsed.data;

  // Idempotent: if this hash was already recorded for the session, no-op.
  const alreadyRecorded = getAuditEntries(sessionId).some(
    (e) => (e.context as Record<string, unknown> | undefined)?.hash === hash,
  );
  if (alreadyRecorded) {
    return Response.json({ ok: true, hash, deduped: true });
  }

  // The client-supplied amount must be a valid wei value.
  let expectedValue: bigint;
  try {
    expectedValue = parseEther(valueEth);
  } catch {
    return Response.json({ error: "Invalid ETH amount" }, { status: 400 });
  }

  // Verify the transaction actually exists on-chain and matches the claim.
  // This is what makes the endpoint forgery-resistant — an attacker cannot
  // record arbitrary spend/audit without a real matching transaction.
  let onChainTo: string | null = null;
  let onChainValue: bigint | null = null;
  try {
    const tx = await publicClient.getTransaction({
      hash: hash as `0x${string}`,
    });
    onChainTo = tx.to ?? null;
    onChainValue = tx.value;
  } catch {
    return Response.json(
      { error: "Transaction not found on-chain" },
      { status: 422 },
    );
  }

  if (!onChainTo || getAddress(onChainTo) !== getAddress(to)) {
    return Response.json(
      { error: "Recipient does not match on-chain transaction" },
      { status: 422 },
    );
  }
  if (onChainValue !== expectedValue) {
    return Response.json(
      { error: "Amount does not match on-chain transaction" },
      { status: 422 },
    );
  }

  // Record the verified spend against this session's budget (defense in depth;
  // record() is append-only and never throws).
  safetySupervisor.recordSpend("sendTransaction", { valueEth }, sessionId);

  // Append a verifiable, hash-chained audit entry via the shared AuditLog.
  const auditLog = new AuditLog(sessionId);
  await auditLog.append({
    eventType: "TOOL_CALL_SUCCESS",
    severity: "info",
    toolName: "sendTransaction",
    idempotencyKey,
    executionStatus: "success",
    context: { hash, to, valueEth, idempotencyKey, signedByUser: true },
  });

  return Response.json({ ok: true, hash });
}
