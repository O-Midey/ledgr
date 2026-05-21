import { openai } from "@ai-sdk/openai";
import { streamText, stepCountIs, tool, convertToModelMessages } from "ai";
import { z } from "zod";

/** JSON replacer that serializes BigInt as a string to avoid serialization errors. */
function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) =>
    typeof val === "bigint" ? val.toString() : val,
  );
}

import { checkRateLimit } from "@/security/rateLimiter";
import {
  scanForInjection,
  sanitizeToolOutput,
} from "@/security/injectionGuard";
import { AuditLog } from "@/audit/auditLog";
import { ExecutionGateway, buildToolCall } from "@/agent/executionGateway";
import { SYSTEM_PROMPT } from "@/prompts/systemPrompt";
import { InjectionDetectedError } from "@/types/errors";
import { generateId } from "@/lib/utils";
import { getAgentAddress } from "@/wallet/walletClient";

function resolveFromAddress(connected: string | null): string {
  if (connected) return connected;
  return getAgentAddress();
}

const MAX_STEPS = parseInt(process.env.MAX_STEPS_PER_TURN ?? "10", 10);

function hasUsableOpenAIKey(): boolean {
  const key = process.env.OPENAI_API_KEY ?? "";
  if (!key || key.length < 20) return false;
  const normalized = key.toLowerCase();
  if (
    normalized.includes("placeholder") ||
    normalized.includes("your_") ||
    normalized.includes("test")
  ) {
    return false;
  }
  return true;
}

const addressSchema = z
  .string()
  .trim()
  .length(42)
  .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid Ethereum address");
const ethAmountSchema = z.number().positive().finite().max(0.1);

type IncomingMessage = {
  id?: string;
  role: string;
  content?: string;
  parts?: Array<{ type?: string; text?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

function extractMessageText(message: IncomingMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string)
      .join("");
  }

  return "";
}

function normalizeToUiMessage(message: IncomingMessage, index: number) {
  if (Array.isArray(message.parts)) {
    return message;
  }

  const text = extractMessageText(message);
  return {
    ...message,
    id: message.id ?? `m-${index}`,
    parts: text ? [{ type: "text", text }] : [],
  };
}

/** Unwrap ExecutionResult so the model sees clean data, not internal metadata. */
function unwrapResult(res: ReturnType<typeof JSON.parse>): unknown {
  if (res?.status === "success") return res.output;
  if (res?.status === "idempotency_hit") return res.output;
  const errMsg = res?.error?.message ?? res?.error ?? "Tool execution failed";
  return { error: errMsg };
}

export async function POST(request: Request) {
  if (!hasUsableOpenAIKey()) {
    return Response.json(
      {
        error:
          "Server is not configured. Set a valid OPENAI_API_KEY in .env.local and restart dev server.",
      },
      { status: 503 },
    );
  }

  // 1. Rate limiting -- applied first
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const connectedAddress = request.headers.get("x-wallet-address") ?? null;
  const sessionId = request.headers.get("x-session-id")?.trim() || generateId();
  const rateResult = checkRateLimit(ip);
  if (!rateResult.allowed) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(rateResult.retryAfterMs! / 1000)),
      },
    });
  }

  let body: { messages?: IncomingMessage[] };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const uiMessages = body.messages ?? [];
  const normalizedMessages = uiMessages.map(normalizeToUiMessage);

  const auditLog = new AuditLog(sessionId);
  const gateway = new ExecutionGateway(auditLog);

  // 2. Injection guard on last user message
  const lastUser = [...uiMessages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const lastUserText = extractMessageText(lastUser);
    try {
      scanForInjection(lastUserText);
    } catch (err) {
      if (err instanceof InjectionDetectedError) {
        await auditLog.append({
          eventType: "INJECTION_DETECTED",
          severity: "critical",
          toolName: undefined,
          context: { raw: lastUserText.slice(0, 100) },
        });
        return Response.json({
          role: "assistant",
          content:
            "I can't share my configuration. How can I help you with your wallet?",
        });
      }
      return new Response("Bad Request", { status: 400 });
    }
  }

  // 3. Stream -- all tool calls route through ExecutionGateway
  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modelMessages = await convertToModelMessages(normalizedMessages as any);
  } catch {
    return Response.json(
      { error: "Invalid chat message format." },
      { status: 400 },
    );
  }

  const now = new Date().toUTCString();
  const walletContext = connectedAddress
    ? `The user's connected wallet address is: ${connectedAddress}. Use it automatically when they say "my wallet", "my balance", "my address", etc.`
    : "No wallet is currently connected.";
  const dynamicSystem = `${SYSTEM_PROMPT}\n\n## Current Context\n- Date/Time (UTC): ${now}\n- ${walletContext}`;

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: dynamicSystem,
    messages: modelMessages,
    stopWhen: stepCountIs(MAX_STEPS),
    tools: {
      getBalance: tool({
        description: "Get the ETH balance for a wallet address on Sepolia.",
        inputSchema: z.object({ address: addressSchema }),
        execute: async ({ address }: { address: string }) => {
          const tc = buildToolCall({
            toolName: "getBalance",
            input: { address },
            sideEffects: false,
          });
          const res = await gateway.execute(tc);
          return unwrapResult(
            JSON.parse(sanitizeToolOutput(safeStringify(res))),
          );
        },
      }),
      estimateGas: tool({
        description: "Estimate gas cost for sending ETH on Sepolia.",
        inputSchema: z.object({ to: addressSchema, value: ethAmountSchema }),
        execute: async ({ to, value }: { to: string; value: number }) => {
          const from = resolveFromAddress(connectedAddress);
          const tc = buildToolCall({
            toolName: "estimateGas",
            input: { from, to, valueEth: String(value) },
            sideEffects: false,
          });
          const res = await gateway.execute(tc);
          return unwrapResult(
            JSON.parse(sanitizeToolOutput(safeStringify(res))),
          );
        },
      }),
      getTransactionHistory: tool({
        description:
          "Retrieve recent ETH transfer history for an address on Sepolia.",
        inputSchema: z.object({
          address: addressSchema,
          limit: z.number().int().min(1).max(25).optional(),
        }),
        execute: async ({
          address,
          limit,
        }: {
          address: string;
          limit?: number;
        }) => {
          const tc = buildToolCall({
            toolName: "getTransactionHistory",
            input: { address, limit },
            sideEffects: false,
          });
          const res = await gateway.execute(tc);
          return unwrapResult(
            JSON.parse(sanitizeToolOutput(safeStringify(res))),
          );
        },
      }),
      getTokenPrice: tool({
        description: "Get current price of a token in a given currency.",
        inputSchema: z.object({
          token: z.enum(["ethereum", "bitcoin", "usd-coin"]),
          currency: z.enum(["usd", "eur", "gbp"]).optional(),
        }),
        execute: async ({
          token,
          currency,
        }: {
          token: string;
          currency?: string;
        }) => {
          const tc = buildToolCall({
            toolName: "getTokenPrice",
            input: { token, currency },
            sideEffects: false,
          });
          const res = await gateway.execute(tc);
          return unwrapResult(
            JSON.parse(sanitizeToolOutput(safeStringify(res))),
          );
        },
      }),
      resolveAddress: tool({
        description: "Resolve a name or alias to an Ethereum address.",
        inputSchema: z.object({ alias: addressSchema }),
        execute: async ({ alias }: { alias: string }) => {
          const tc = buildToolCall({
            toolName: "resolveAddress",
            input: { alias },
            sideEffects: false,
          });
          const res = await gateway.execute(tc);
          return unwrapResult(
            JSON.parse(sanitizeToolOutput(safeStringify(res))),
          );
        },
      }),
      sendTransaction: tool({
        description:
          "Send ETH to an address on Sepolia. Requires explicit user confirmation.",
        inputSchema: z.object({
          to: addressSchema,
          value: ethAmountSchema,
          memo: z.string().max(100).optional(),
          idempotencyKey: z.string().min(8).max(64),
        }),
        execute: async ({
          to,
          value,
          memo,
          idempotencyKey,
        }: {
          to: string;
          value: number;
          memo?: string;
          idempotencyKey: string;
        }) => {
          if (!connectedAddress) {
            return {
              error:
                "Connect your wallet to send transactions. Simulation and signing require your connected address.",
            };
          }
          const tc = buildToolCall({
            toolName: "sendTransaction",
            input: {
              to,
              valueEth: String(value),
              memo,
              idempotencyKey,
              from: connectedAddress,
            },
            sideEffects: true,
            idempotencyKey,
          });
          const res = await gateway.propose(tc);
          return unwrapResult(
            JSON.parse(sanitizeToolOutput(safeStringify(res))),
          );
        },
      }),
    },
    onError: async ({ error }) => {
      await auditLog.append({
        eventType: "TOOL_CALL_FAILED",
        severity: "error",
        toolName: undefined,
        context: { message: String(error) },
      });
    },
  });

  const stream = result.toUIMessageStreamResponse();
  const headers = new Headers(stream.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Session-Id", sessionId);
  return new Response(stream.body, { status: stream.status, headers });
}
