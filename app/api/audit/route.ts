import { getAuditEntries } from "@/audit/sessionStore";
import {
  createSessionCookieHeader,
  resolveSessionIdFromRequest,
} from "@/lib/session";

export async function GET(request: Request) {
  const { sessionId, needsCookie } = resolveSessionIdFromRequest(request);

  const entries = getAuditEntries(sessionId).map((e) => ({
    id: e.id,
    eventType: e.eventType,
    toolName: e.toolName,
    timestamp: e.timestamp,
    severity: e.severity,
    executionStatus: e.executionStatus,
  }));

  const response = Response.json({ entries, sessionId });
  if (needsCookie) {
    response.headers.set("Set-Cookie", createSessionCookieHeader(sessionId));
  }

  return response;
}
