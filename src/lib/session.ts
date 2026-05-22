import { generateId } from "@/lib/utils";

export const SESSION_COOKIE_NAME = "ledgr-session-id";
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function parseCookieHeader(
  cookieHeader: string | null,
): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((part) => {
    const [rawKey, ...rawValue] = part.split("=");
    const key = rawKey?.trim();
    if (!key) return;
    cookies.set(key, decodeURIComponent(rawValue.join("=").trim()));
  });

  return cookies;
}

export function readSessionCookie(cookieHeader: string | null): string | null {
  const cookies = parseCookieHeader(cookieHeader);
  const sessionId = cookies.get(SESSION_COOKIE_NAME)?.trim();
  return sessionId || null;
}

export function readClientSessionCookie(): string | null {
  if (typeof document === "undefined") return null;
  return readSessionCookie(document.cookie);
}

export function createSessionCookieHeader(sessionId: string): string {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`,
  ].join("; ");
}

export function getOrCreateClientSessionId(): string {
  const existing = readClientSessionCookie();
  if (existing) return existing;

  const sessionId = generateId();
  if (typeof document !== "undefined") {
    document.cookie = createSessionCookieHeader(sessionId);
  }
  return sessionId;
}

export function resolveSessionIdFromRequest(request: Request): {
  sessionId: string;
  needsCookie: boolean;
} {
  const headerSessionId = request.headers.get("x-session-id")?.trim();
  if (headerSessionId) {
    return { sessionId: headerSessionId, needsCookie: false };
  }

  const cookieSessionId = readSessionCookie(request.headers.get("cookie"));
  if (cookieSessionId) {
    return { sessionId: cookieSessionId, needsCookie: false };
  }

  return { sessionId: generateId(), needsCookie: true };
}
