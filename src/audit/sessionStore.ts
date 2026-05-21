import type { AuditEntry } from "@/types/audit";

const store = new Map<string, AuditEntry[]>();

export function recordAuditEntry(sessionId: string, entry: AuditEntry): void {
  const list = store.get(sessionId) ?? [];
  list.push(entry);
  store.set(sessionId, list);
}

export function getAuditEntries(sessionId: string): readonly AuditEntry[] {
  return store.get(sessionId) ?? [];
}

export function formatAuditForSidebar(entries: readonly AuditEntry[]) {
  return [...entries]
    .reverse()
    .slice(0, 12)
    .map((e) => ({
      action: e.toolName ?? e.eventType.toLowerCase().replace(/_/g, " "),
      time: new Date(e.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status:
        e.executionStatus === "failed" || e.severity === "error"
          ? ("error" as const)
          : e.eventType.includes("START") || e.eventType.includes("SIMULATION")
            ? ("running" as const)
            : ("success" as const),
      eventType: e.eventType,
      severity: e.severity,
      toolName: e.toolName,
      hash: e.hash,
      previousHash: e.previousHash,
    }));
}
