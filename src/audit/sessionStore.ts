import type { AuditEntry } from "@/types/audit";
import type { UIMessage } from "ai";
import { GENESIS_HASH } from "@/lib/constants";

type ChatMessage = { [key: string]: unknown } | UIMessage;

interface WalletContextEvent {
  address: string;
  timestamp: number;
}

interface SessionState {
  auditEntries: AuditEntry[];
  chatMessages: ChatMessage[];
  walletAddress: string | null;
  walletHistory: WalletContextEvent[];
  lastAccess: number;
}

const store = new Map<string, SessionState>();
const MAX_SESSIONS = 1000;

/** Evict the least-recently-accessed session when the cap is reached. */
function evictIfNeeded(): void {
  if (store.size < MAX_SESSIONS) return;
  let oldestKey: string | null = null;
  let oldest = Infinity;
  for (const [key, state] of store) {
    if (state.lastAccess < oldest) {
      oldest = state.lastAccess;
      oldestKey = key;
    }
  }
  if (oldestKey) store.delete(oldestKey);
}

function getOrCreateSessionState(sessionId: string): SessionState {
  const existing = store.get(sessionId);
  if (existing) {
    existing.lastAccess = Date.now();
    return existing;
  }

  evictIfNeeded();
  const created: SessionState = {
    auditEntries: [],
    chatMessages: [],
    walletAddress: null,
    walletHistory: [],
    lastAccess: Date.now(),
  };
  store.set(sessionId, created);
  return created;
}

export function recordAuditEntry(sessionId: string, entry: AuditEntry): void {
  const state = getOrCreateSessionState(sessionId);
  state.auditEntries.push(entry);
}

export function getAuditEntries(sessionId: string): readonly AuditEntry[] {
  return getOrCreateSessionState(sessionId).auditEntries;
}

/**
 * Hash of the last persisted audit entry for a session, or GENESIS if none.
 * Used to seed a new AuditLog so the hash chain stays continuous across
 * requests instead of restarting from genesis each time.
 */
export function getLastAuditHash(sessionId: string): string {
  const entries = getOrCreateSessionState(sessionId).auditEntries;
  const last = entries[entries.length - 1];
  return last?.hash ?? GENESIS_HASH;
}

export function recordChatMessages(
  sessionId: string,
  messages: readonly ChatMessage[],
  walletAddress?: string | null,
): void {
  const state = getOrCreateSessionState(sessionId);
  state.chatMessages = [...messages] as ChatMessage[];

  if (walletAddress && walletAddress.trim()) {
    const normalized = walletAddress.trim();
    state.walletAddress = normalized;
    const last = state.walletHistory[state.walletHistory.length - 1];
    if (!last || last.address !== normalized) {
      state.walletHistory = [
        ...state.walletHistory,
        { address: normalized, timestamp: Date.now() },
      ];
    }
  }
}

export function getChatMessages(sessionId: string): readonly ChatMessage[] {
  return getOrCreateSessionState(sessionId).chatMessages;
}

export function getSessionWalletContext(sessionId: string): {
  walletAddress: string | null;
  walletHistory: readonly WalletContextEvent[];
} {
  const state = getOrCreateSessionState(sessionId);
  return {
    walletAddress: state.walletAddress,
    walletHistory: state.walletHistory,
  };
}

export function getSessionSnapshot(sessionId: string) {
  const state = getOrCreateSessionState(sessionId);
  return {
    sessionId,
    messages: state.chatMessages,
    auditEntries: state.auditEntries,
    walletAddress: state.walletAddress,
    walletHistory: state.walletHistory,
  };
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
