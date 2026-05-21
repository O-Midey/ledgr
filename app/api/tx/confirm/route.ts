import { safetySupervisor } from "@/agent/supervisor";
import { recordAuditEntry } from "@/audit/sessionStore";
import { generateId, nowMs } from "@/lib/utils";
import { GENESIS_HASH } from "@/lib/constants";

async function appendClientAudit(
  sessionId: string,
  params: {
    eventType: string;
    toolName: string;
    context: Record<string, unknown>;
  },
) {
  const base = JSON.stringify({
    sessionId,
    eventType: params.eventType,
    timestamp: nowMs(),
    toolName: params.toolName,
    context: params.context,
    previousHash: GENESIS_HASH,
  });
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(base),
  );
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  recordAuditEntry(sessionId, {
    id: generateId(),
    sessionId,
    eventType: params.eventType as "TOOL_CALL_SUCCESS",
    severity: "info",
    timestamp: nowMs(),
    toolName: params.toolName,
    executionStatus: "success",
    context: params.context,
    hash,
    previousHash: GENESIS_HASH,
  });
}

export async function POST(request: Request) {
  let body: {
    sessionId?: string;
    hash?: string;
    valueEth?: string;
    to?: string;
    idempotencyKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, hash, valueEth, to, idempotencyKey } = body;
  if (!sessionId || !hash || !valueEth) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    safetySupervisor.recordSpend("sendTransaction", { valueEth });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 400 });
  }

  await appendClientAudit(sessionId, {
    eventType: "TOOL_CALL_SUCCESS",
    toolName: "sendTransaction",
    context: {
      hash,
      to,
      valueEth,
      idempotencyKey,
      signedByUser: true,
    },
  });

  return Response.json({ ok: true, hash });
}
