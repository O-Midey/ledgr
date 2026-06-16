import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import { checkRateLimit } from "@/security/rateLimiter";
import { heuristicTitle } from "@/lib/generateTitle";

/**
 * Generates a concise conversation title from the user's first message.
 * Always returns a usable title: falls back to a local heuristic when the
 * model is unavailable, rate-limited, or returns nothing.
 */
const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

const TITLE_SYSTEM = `You generate a very short title (3-5 words) summarizing a user's message to Ledgr, a crypto wallet assistant on the Ethereum Sepolia testnet.
Rules:
- Return ONLY the title text — no quotes, no trailing punctuation, no preamble.
- Use Title Case.
- Be specific (e.g. "Check ETH Balance", "Send 0.01 ETH", "Recent Transaction History").`;

function hasUsableOpenAIKey(): boolean {
  const key = process.env.OPENAI_API_KEY ?? "";
  if (key.length < 20) return false;
  return !/placeholder|your_|test/i.test(key);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad Request" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { message } = parsed.data;
  const fallback = heuristicTitle(message);

  // Title generation is best-effort: degrade to the heuristic rather than error.
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  if (!checkRateLimit(ip).allowed || !hasUsableOpenAIKey()) {
    return Response.json({ title: fallback });
  }

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: TITLE_SYSTEM,
      prompt: message.slice(0, 500),
      maxOutputTokens: 16,
      temperature: 0.3,
    });
    const title = text.replace(/^["'\s]+|["'.\s]+$/g, "").trim();
    return Response.json({ title: title || fallback });
  } catch {
    return Response.json({ title: fallback });
  }
}
