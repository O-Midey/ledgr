import {
  createSessionCookieHeader,
  resolveSessionIdFromRequest,
} from "@/lib/session";
import { getSessionSnapshot } from "@/audit/sessionStore";

export async function GET(request: Request) {
  const { sessionId, needsCookie } = resolveSessionIdFromRequest(request);
  const snapshot = getSessionSnapshot(sessionId);

  const response = Response.json(snapshot);
  if (needsCookie) {
    response.headers.set("Set-Cookie", createSessionCookieHeader(sessionId));
  }

  return response;
}
