import { z } from "zod";
import { checkRateLimit } from "@/security/rateLimiter";
import { sanitizeToolOutput } from "@/security/injectionGuard";
import { AuditLog } from "@/audit/auditLog";
import { ExecutionGateway, buildToolCall } from "@/agent/executionGateway";
import {
  createSessionCookieHeader,
  resolveSessionIdFromRequest,
} from "@/lib/session";
import { MAX_SINGLE_TX_ETH } from "@/lib/constants";

/**
 * Build a client-signed send proposal directly, skipping the LLM turn.
 *
 * The chat agent normally produces this same `{ pendingConfirmation, proposal }`
 * by calling the `sendTransaction` tool. When the user has already supplied an
 * exact recipient + amount (e.g. "Proceed with send" after a gas estimate),
 * routing through the model adds a multi-second round-trip and a redundant-
 * looking message for no benefit. This endpoint runs the *identical* security
 * pipeline — schema validation, on-chain simulation, and the safety supervisor,
 * via `ExecutionGateway.propose` — so the proposal is no less vetted than the
 * agent-produced one. It never broadcasts; signing still happens client-side.
 */
const proposeSchema = z.object({
  to: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid Ethereum address"),
  // Kept as a string to match the tool's `valueEth` contract; the gateway's
  // schema enforces positivity and the MAX_SINGLE_TX_ETH ceiling.
  valueEth: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Must be a positive numeric ETH amount")
    .refine((v) => parseFloat(v) > 0, "Amount must be positive")
    .refine(
      (v) => parseFloat(v) <= MAX_SINGLE_TX_ETH,
      `Max single tx is ${MAX_SINGLE_TX_ETH} ETH`,
    ),
  idempotencyKey: z.string().trim().min(8).max(64),
  connectedAddress: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid connected address"),
});

/** Collapse an ExecutionResult into the client-facing proposal or error. */
function toClientPayload(res: {
  status: string;
  output?: unknown;
  error?: { message?: string; context?: Record<string, unknown> } | string;
}): { ok: true; output: unknown } | { ok: false; error: string } {
  if (res.status === "success" || res.status === "idempotency_hit") {
    return { ok: true, output: res.output };
  }
  const base =
    (typeof res.error === "object" ? res.error?.message : res.error) ??
    "Transaction could not be prepared";
  const ctx = typeof res.error === "object" ? res.error?.context : undefined;
  const suggestion =
    ctx && typeof ctx.suggestion === "string" ? ` ${ctx.suggestion}` : "";
  return { ok: false, error: `${base}${suggestion}` };
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs! / 1000)) },
    });
  }

  const { sessionId, needsCookie } = resolveSessionIdFromRequest(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = proposeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { to, valueEth, idempotencyKey, connectedAddress } = parsed.data;

  const gateway = new ExecutionGateway(new AuditLog(sessionId), sessionId);
  const call = buildToolCall({
    toolName: "sendTransaction",
    input: { to, valueEth, idempotencyKey, from: connectedAddress },
    sideEffects: true,
    idempotencyKey,
  });

  const res = await gateway.propose(call);
  const payload = toClientPayload(
    JSON.parse(sanitizeToolOutput(JSON.stringify(res))),
  );

  const status = payload.ok ? 200 : 422;
  const responseBody = payload.ok ? payload.output : { error: payload.error };
  const base = Response.json(responseBody, { status });
  const headers = new Headers(base.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Session-Id", sessionId);
  if (needsCookie) {
    headers.set("Set-Cookie", createSessionCookieHeader(sessionId));
  }
  return new Response(base.body, { status, headers });
}
