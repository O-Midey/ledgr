import { getAuditEntries } from "@/audit/sessionStore";

export async function GET(request: Request) {
  const sessionId = request.headers.get("x-session-id")?.trim();
  if (!sessionId) {
    return Response.json({ entries: [] });
  }

  const entries = getAuditEntries(sessionId).map((e) => ({
    id: e.id,
    eventType: e.eventType,
    toolName: e.toolName,
    timestamp: e.timestamp,
    severity: e.severity,
    executionStatus: e.executionStatus,
  }));

  return Response.json({ entries });
}
