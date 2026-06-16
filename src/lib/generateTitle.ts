/**
 * Conversation title generation.
 *
 * Primary path: a cheap LLM call (`/api/title`) produces a concise, human title
 * like ChatGPT does. Fallback path: a local heuristic derived from the first
 * user message, used when the API is unavailable or returns nothing — so a
 * conversation always gets a sensible title even offline.
 */

const DEFAULT_TITLE = "New conversation";
const MAX_TITLE_LEN = 48;

const FILLER_PREFIXES = [
  "can you",
  "could you",
  "please",
  "hey",
  "hi",
  "hello",
  "i want to",
  "i need to",
  "i would like to",
  "help me",
  "lets",
  "let's",
];

/** Derive a clean, Title-ish label from a raw user message. Pure + offline. */
export function heuristicTitle(message: string): string {
  let text = message.replace(/\s+/g, " ").trim();
  if (!text) return DEFAULT_TITLE;

  const lower = text.toLowerCase();
  for (const prefix of FILLER_PREFIXES) {
    if (lower.startsWith(`${prefix} `)) {
      text = text.slice(prefix.length).trim();
      break;
    }
  }
  if (!text) return DEFAULT_TITLE;

  // Truncate at a word boundary so we never cut a word in half.
  if (text.length > MAX_TITLE_LEN) {
    const clipped = text.slice(0, MAX_TITLE_LEN);
    const lastSpace = clipped.lastIndexOf(" ");
    text = (lastSpace > 20 ? clipped.slice(0, lastSpace) : clipped).trim() + "…";
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Request a concise title for a conversation from its first user message.
 * Always resolves to a usable title — never throws.
 */
export async function requestChatTitle(message: string): Promise<string> {
  const fallback = heuristicTitle(message);
  try {
    const res = await fetch("/api/title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { title?: unknown };
    const title =
      typeof data.title === "string" ? data.title.trim() : "";
    return title ? title.slice(0, MAX_TITLE_LEN) : fallback;
  } catch {
    return fallback;
  }
}
