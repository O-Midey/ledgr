"use client";

import dynamic from "next/dynamic";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useChainId, useAccount as useWagmiAccount, useBalance } from "wagmi";
import { sepolia } from "viem/chains";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { ToolUIPart } from "./TxPreviewCard";
import type { SuggestionChip } from "./ContextualChips";
import type { AddressAlias } from "@/lib/useAddressBook";
import { useAddressBook } from "@/lib/useAddressBook";
import { isTxProposalOutput, type TxProposal } from "@/lib/txProposal";
import { formatAuditForSidebar } from "@/audit/sessionStore";
import { generateId } from "@/lib/utils";
import { requestChatTitle } from "@/lib/generateTitle";
import { useTxTracker, type TxNotice } from "@/lib/txTracker";

const AssistantMessage = dynamic(
  () => import("./AssistantMessage").then((mod) => mod.AssistantMessage),
  {
    loading: () => <AssistantMessageSkeleton />,
  },
);

const WalletSidebar = dynamic(
  () => import("./WalletSidebar").then((mod) => mod.WalletSidebar),
  {
    loading: () => <WalletSidebarSkeleton />,
  },
);

const ConfirmTxModal = dynamic(
  () => import("./ConfirmTxModal").then((mod) => mod.ConfirmTxModal),
  {
    loading: () => null,
  },
);

const AddressBookPanel = dynamic(
  () => import("./AddressBookPanel").then((mod) => mod.AddressBookPanel),
  {
    loading: () => null,
  },
);

const AddressSuggestions = dynamic(
  () => import("./AddressSuggestions").then((mod) => mod.AddressSuggestions),
  {
    loading: () => null,
  },
);

const ContextualChips = dynamic(
  () => import("./ContextualChips").then((mod) => mod.ContextualChips),
  {
    loading: () => null,
  },
);

const QuickActionCard = dynamic(
  () => import("./QuickActionCard").then((mod) => mod.QuickActionCard),
  {
    loading: () => null,
  },
);

function findPendingProposal(
  messages: { role: string; parts: unknown[] }[],
  dismissed: Set<string>,
): TxProposal | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    for (const p of m.parts) {
      const part = p as { type?: string; state?: string; output?: unknown };
      if (!part.type?.includes("sendTransaction")) continue;
      if (part.state !== "output-available") continue;
      if (!isTxProposalOutput(part.output)) continue;
      const key = part.output.proposal.idempotencyKey;
      if (dismissed.has(key)) continue;
      return part.output.proposal;
    }
  }
  return null;
}

const SUGGESTIONS = [
  "Check my ETH balance",
  "Send 0.01 ETH to vitalik.eth",
  "Show recent transactions",
  "Estimate gas for a transfer",
];

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message.trim()
      : typeof error === "string"
        ? error.trim()
        : "";

  if (message) {
    const lower = message.toLowerCase();
    if (lower.includes("429") || lower.includes("too many requests")) {
      return "Rate limit reached. Please wait a few seconds and retry.";
    }
    if (lower.includes("503") || lower.includes("not configured")) {
      return "Server configuration is incomplete. Set required env vars and restart.";
    }
    if (lower.includes("network") || lower.includes("fetch")) {
      return "Network issue while contacting Ledgr. Check connection and retry.";
    }
    return message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "The request did not complete. Please try again.";
}

const SESSION_ID_STORAGE_KEY = "ledgr-chat-session-id";
const CHAT_MESSAGES_STORAGE_PREFIX = "ledgr-chat-messages:";
const HANDLED_PROPOSALS_STORAGE_PREFIX = "ledgr-handled-proposals:";

const MESSAGE_TIMES_STORAGE_PREFIX = "ledgr-msg-times:";

/**
 * Load stable per-message send times for this session. Without this, every
 * message renders `new Date()` and shows the current clock on each re-render.
 */
function loadMessageTimes(sessionId: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(
      `${MESSAGE_TIMES_STORAGE_PREFIX}${sessionId}`,
    );
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Load the set of proposal idempotency keys the user has already acted on
 * (confirmed or dismissed) for this session. Persisted so a page reload can't
 * re-surface an already-signed transaction proposal and trigger a double-send.
 */
function loadHandledProposals(sessionId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(
      `${HANDLED_PROPOSALS_STORAGE_PREFIX}${sessionId}`,
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is string => typeof k === "string");
  } catch {
    return [];
  }
}

function isValidUiMessage(value: unknown): value is UIMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { role?: unknown; parts?: unknown };
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    Array.isArray(candidate.parts)
  );
}

function loadPersistedMessages(sessionId: string): UIMessage[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(
      `${CHAT_MESSAGES_STORAGE_PREFIX}${sessionId}`,
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidUiMessage) as UIMessage[];
  } catch {
    return [];
  }
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return generateId();

  try {
    const existing = sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (existing && existing.trim()) {
      return existing;
    }

    const created = generateId();
    sessionStorage.setItem(SESSION_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return generateId();
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

interface AuditEntry {
  action: string;
  time: string;
  status: "success" | "running" | "error";
  eventType: string;
  severity: "info" | "warn" | "error" | "critical";
  toolName?: string;
  hash?: string;
  previousHash?: string;
  duration?: string;
}

interface QuickActionDraft {
  mode: "send" | "gas";
  initialAddress?: string;
  initialAmount?: string;
}

// ── Main component ─────────────────────────────────────────────────────────

export function ChatInterface({
  sessionId: sessionIdProp,
  needsTitle = false,
  onTitle,
  onTitleStart,
}: {
  sessionId?: string;
  needsTitle?: boolean;
  onTitle?: (title: string) => void;
  onTitleStart?: () => void;
} = {}) {
  const { isConnected, address } = useWagmiAccount();
  const chainId = useChainId();
  const isWrongNetwork = isConnected && chainId !== sepolia.id;
  const { aliases } = useAddressBook();

  const { data: balanceData, isLoading: balanceLoading } = useBalance({
    address,
    chainId: sepolia.id,
    query: { enabled: isConnected && !!address },
  });

  const sessionId = useMemo(
    () => sessionIdProp ?? getOrCreateSessionId(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const persistedMessages = useMemo(
    () => loadPersistedMessages(sessionId),
    [sessionId],
  );
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: { "x-session-id": sessionId },
      }),
    [sessionId],
  );
  const [showRetry, setShowRetry] = useState(false);
  const retriedRef = useRef(false);
  const regenerateRef = useRef<(() => void) | null>(null);

  const { messages, sendMessage, status, error, regenerate, setMessages } =
    useChat({
      id: sessionId,
      messages: persistedMessages,
      transport,
      // Auto-retry once on transient errors only. Rate-limit / config /
      // bad-request errors won't succeed on an immediate retry, so we surface
      // the manual retry banner instead of wasting a request. Handling this in
      // the error callback (vs an effect) avoids cascading-render setState.
      onError: (err) => {
        if (retriedRef.current) {
          setShowRetry(true);
          return;
        }
        retriedRef.current = true;
        const msg = (
          err instanceof Error ? err.message : String(err)
        ).toLowerCase();
        const nonRetryable =
          msg.includes("429") ||
          msg.includes("too many") ||
          msg.includes("rate limit") ||
          msg.includes("503") ||
          msg.includes("not configured") ||
          msg.includes("400") ||
          msg.includes("bad request") ||
          msg.includes("invalid");
        if (nonRetryable) {
          setShowRetry(true);
        } else {
          regenerateRef.current?.();
        }
      },
    });

  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addressBookOpen, setAddressBookOpen] = useState(false);
  const [addressSuggestionQuery, setAddressSuggestionQuery] = useState("");
  const [dismissedProposals, setDismissedProposals] = useState<Set<string>>(
    () => new Set(loadHandledProposals(sessionId)),
  );
  const [serverAudit, setServerAudit] = useState<AuditEntry[]>([]);
  const tracker = useTxTracker();
  const sessionNotices = tracker.noticesForSession(sessionId);
  // Write-once cache of per-message send times (id → epoch ms). Stamped lazily
  // during render and persisted in an effect; avoids setState-in-effect.
  const messageTimesRef = useRef<Record<string, number> | null>(null);
  if (messageTimesRef.current === null) {
    messageTimesRef.current = loadMessageTimes(sessionId);
  }
  const messageTimeFor = useCallback((id: string): number => {
    const map = (messageTimesRef.current ??= {});
    if (map[id] == null) map[id] = Date.now();
    return map[id];
  }, []);
  const [quickActionDraft, setQuickActionDraft] =
    useState<QuickActionDraft | null>(null);
  const titleRequestedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const lastMessageCountRef = useRef(0);

  const isLoading = status === "streaming" || status === "submitted";
  const isStreaming = status === "streaming";
  const lastIsUser =
    messages.length > 0 && messages[messages.length - 1].role === "user";
  const showThinking = status === "submitted" && lastIsUser;
  const requestErrorMessage = error ? getErrorMessage(error) : "";
  const shouldShowRetry = showRetry && !!error;

  // ── Smart auto-scroll: only if user is near bottom ──
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY < 0) {
      isNearBottomRef.current = false;
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    const hasNewMessage = messages.length !== lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;

    if (!el || !isNearBottomRef.current) return;

    el.scrollTo({
      top: el.scrollHeight,
      behavior: hasNewMessage && !isStreaming ? "smooth" : "auto",
    });
  }, [messages, showThinking, isStreaming]);

  // Keep the latest regenerate available to the onError callback above.
  useEffect(() => {
    regenerateRef.current = regenerate;
  }, [regenerate]);

  // ── Textarea auto-resize on input change (shrinks too) ──
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "36px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 36), 160)}px`;
  }, [input]);

  // ── Focus the composer on load so opening / starting a chat lands ready ──
  // The component remounts per conversation (keyed), so this also covers
  // switching and starting a new chat.
  useEffect(() => {
    if (isWrongNetwork) return;
    textareaRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Hydrate chat from the server session when local history is empty ──
  // (e.g. localStorage was cleared, or opened on another device). Runs once on
  // mount; local history always wins when present.
  useEffect(() => {
    if (persistedMessages.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/session", {
          headers: { "x-session-id": sessionId },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: unknown };
        if (cancelled || !Array.isArray(data.messages)) return;
        const valid = data.messages.filter(isValidUiMessage);
        if (valid.length > 0) setMessages(valid);
      } catch {
        /* network error during hydration; continue with empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, persistedMessages, setMessages]);

  const submitPrompt = useCallback(
    async (text: string) => {
      const normalizedText = text.trim();
      if (!normalizedText || isWrongNetwork || isLoading) return;

      retriedRef.current = false;
      setShowRetry(false);
      setQuickActionDraft(null);
      setInput("");
      isNearBottomRef.current = true;

      await sendMessage(
        { text: normalizedText },
        {
          body: {
            connectedAddress: address,
            addressBook: aliases.map((a) => ({
              alias: a.alias,
              address: a.address,
            })),
          },
        },
      );
    },
    [isWrongNetwork, isLoading, sendMessage, address, aliases],
  );

  const handleContextualChip = useCallback(
    (chip: SuggestionChip) => {
      if (chip.kind === "send-form") {
        setQuickActionDraft({
          mode: "send",
          initialAddress: chip.initialAddress,
          initialAmount: chip.initialAmount,
        });
        return;
      }

      if (chip.kind === "gas-form") {
        setQuickActionDraft({
          mode: "gas",
          initialAddress: chip.initialAddress,
          initialAmount: chip.initialAmount,
        });
        return;
      }

      void submitPrompt(chip.action);
    },
    [submitPrompt],
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      await submitPrompt(input);
    },
    [input, submitPrompt],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const refreshAudit = useCallback(async () => {
    try {
      const res = await fetch("/api/audit", {
        headers: { "x-session-id": sessionId },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.entries) && data.entries.length > 0) {
        setServerAudit(formatAuditForSidebar(data.entries));
      }
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  const handleSelectAddressAlias = useCallback(
    (alias: AddressAlias) => {
      // Insert address into input at current cursor position or end
      const textarea = textareaRef.current;
      if (!textarea) {
        setInput((prev) => `${prev} ${alias.address}`);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const beforeCursor = input.substring(0, start);
      const afterCursor = input.substring(end);
      const newInput = `${beforeCursor}${alias.address}${afterCursor}`;

      setInput(newInput);
      setAddressSuggestionQuery("");

      // Restore cursor position after address
      setTimeout(() => {
        if (textarea) {
          const newCursorPos = start + alias.address.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        }
      }, 0);
    },
    [input],
  );

  useEffect(() => {
    if (status === "ready" || status === "streaming") {
      const timeoutId = window.setTimeout(() => {
        void refreshAudit();
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [status, messages, refreshAudit]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const key = `${CHAT_MESSAGES_STORAGE_PREFIX}${sessionId}`;
      if (messages.length === 0) {
        localStorage.removeItem(key);
        return;
      }
      localStorage.setItem(key, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
  }, [messages, sessionId]);

  // Persist message send times after render (touches localStorage only — the
  // stamps themselves are assigned lazily during render via messageTimeFor).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        `${MESSAGE_TIMES_STORAGE_PREFIX}${sessionId}`,
        JSON.stringify(messageTimesRef.current ?? {}),
      );
    } catch {
      /* ignore */
    }
  }, [messages, sessionId]);

  // Generate a concise conversation title from the first user message, once.
  // Flows through the conversations data layer so the panel updates live.
  useEffect(() => {
    if (!needsTitle || titleRequestedRef.current || !onTitle) return;
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return;
    const text = firstUser.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("")
      .trim();
    if (!text) return;
    titleRequestedRef.current = true;
    onTitleStart?.();
    void requestChatTitle(text).then((title) => {
      if (title) onTitle(title);
    });
  }, [messages, needsTitle, onTitle, onTitleStart]);

  // Refresh the audit trail when a new receipt lands for this chat. The
  // confirmation POST now happens in the tx tracker (possibly while another
  // conversation is open), so the entry appears after the usual status-driven
  // refresh would have run.
  const prevNoticeCountRef = useRef(sessionNotices.length);
  useEffect(() => {
    if (sessionNotices.length > prevNoticeCountRef.current) {
      void refreshAudit();
    }
    prevNoticeCountRef.current = sessionNotices.length;
  }, [sessionNotices.length, refreshAudit]);

  // Persist handled (confirmed/dismissed) proposal keys so a reload can't
  // re-surface an already-signed proposal and allow a double-send.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        `${HANDLED_PROPOSALS_STORAGE_PREFIX}${sessionId}`,
        JSON.stringify(Array.from(dismissedProposals)),
      );
    } catch {
      /* ignore */
    }
  }, [dismissedProposals, sessionId]);

  const clientAudit = useMemo<AuditEntry[]>(() => {
    const entries: AuditEntry[] = [];
    messages.forEach((m) => {
      if (m.role === "user") {
        entries.push({
          action: "user_input",
          time: formatTime(new Date()),
          status: "success",
          eventType: "USER_INPUT",
          severity: "info",
        });
      }
      if (m.role === "assistant") {
        m.parts.forEach((p) => {
          if (p.type.startsWith("tool-") || p.type === "dynamic-tool") {
            const tp = p as unknown as ToolUIPart;
            const toolName = tp.toolName ?? p.type.replace(/^tool-/, "");
            entries.push({
              action: toolName,
              time: formatTime(new Date()),
              status:
                tp.state === "output-available"
                  ? "success"
                  : tp.state === "output-error"
                    ? "error"
                    : "running",
              eventType:
                tp.state === "output-available"
                  ? "TOOL_CALL_SUCCESS"
                  : tp.state === "output-error"
                    ? "TOOL_CALL_FAILED"
                    : "TOOL_CALL_START",
              severity: tp.state === "output-error" ? "error" : "info",
              toolName,
            });
          }
        });
      }
    });
    if (showThinking) {
      entries.push({
        action: "agent_thinking",
        time: formatTime(new Date()),
        status: "running",
        eventType: "AGENT_THINKING",
        severity: "info",
      });
    }
    return entries.slice(-8).reverse();
  }, [messages, showThinking]);

  const auditEntries = serverAudit.length > 0 ? serverAudit : clientAudit;

  const pendingProposal = useMemo(() => {
    const proposal = findPendingProposal(messages, dismissedProposals);
    if (!proposal) return null;
    // A transaction for this proposal is already being tracked — don't re-open
    // the confirmation modal (guards against double-send on re-render).
    if (tracker.isTracked(proposal.idempotencyKey)) {
      return null;
    }
    return proposal;
  }, [messages, dismissedProposals, tracker]);

  const hasMessages = messages.length > 0;

  const txLiveAnnouncement = useMemo(() => {
    const notices = tracker.noticesForSession(sessionId);
    const latestNotice = notices[notices.length - 1];
    if (latestNotice) {
      if (latestNotice.status === "confirmed") {
        return `Transaction confirmed. ${latestNotice.valueEth} ETH sent to ${latestNotice.to}.`;
      }
      if (latestNotice.status === "reverted") {
        return "Transaction reverted on-chain.";
      }
      return "Transaction confirmation delayed.";
    }

    const statuses = tracker.statusesForSession(sessionId);
    const latest = statuses[statuses.length - 1];
    if (!latest) return "";
    if (latest.phase === "signature_requested") {
      return "Transaction signature requested in wallet.";
    }
    if (latest.phase === "submitted") {
      return "Transaction submitted to Sepolia.";
    }
    if (latest.phase === "confirming") {
      return latest.isStuck
        ? "Transaction is taking longer than usual to confirm."
        : "Waiting for on-chain confirmation.";
    }
    if (latest.phase === "failed") {
      return "Transaction confirmation failed.";
    }
    return "";
  }, [tracker, sessionId]);

  const handleTxSubmitted = useCallback(
    (hash: `0x${string}`, proposal: TxProposal) => {
      if (pendingProposal) {
        setDismissedProposals((s) =>
          new Set(s).add(pendingProposal.idempotencyKey),
        );
      }
      // Hand off to the account-scoped tracker, tagged with this conversation so
      // the receipt routes back here even if the user is in another chat when it
      // confirms. The tracker owns the chain watcher and confirmation POST.
      tracker.track({
        hash,
        to: proposal.to,
        valueEth: proposal.valueEth,
        idempotencyKey: proposal.idempotencyKey,
        sessionId,
      });
    },
    [pendingProposal, tracker, sessionId],
  );

  const handleTxLifecycleChange = useCallback(
    (_phase: "signature_requested", proposal: TxProposal) => {
      tracker.setSignatureRequested({
        to: proposal.to,
        valueEth: proposal.valueEth,
        idempotencyKey: proposal.idempotencyKey,
        sessionId,
      });
    },
    [tracker, sessionId],
  );

  return (
    <div className="chat-body">
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {txLiveAnnouncement}
      </div>
      <div
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        {showRetry ? "Request failed. Retry is available." : ""}
      </div>
      <div className="chat-column">
        <div
          className="chat-messages"
          ref={scrollRef}
          onScroll={handleScroll}
          onWheel={handleWheel}
        >
          {/* Empty state */}
          {!hasMessages && (
            <div className="empty-state animate-fade-in">
              {/* <div className="empty-state-mark" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3 3 7.5 12 12l9-4.5L12 3Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3 12l9 4.5L21 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3 16.5 12 21l9-4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div> */}
              <div className="empty-state-title">
                {isConnected
                  ? "What can I do for your wallet?"
                  : "Your AI wallet copilot on Sepolia"}
              </div>
              <div className="empty-state-sub">
                {isConnected
                  ? `Connected ${address?.slice(0, 6)}…${address?.slice(-4)}. Ask me to check balances, estimate gas, or send ETH — every action is simulated and audited.`
                  : "Connect your wallet to check balances, estimate gas, send ETH, and inspect a tamper-evident audit trail — all on the Sepolia testnet."}
              </div>
              <div className="empty-state-caps" aria-hidden="true">
                <span className="cap-pill">Balances</span>
                <span className="cap-pill">Gas estimates</span>
                <span className="cap-pill">Send ETH</span>
                <span className="cap-pill">Audit trail</span>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((m, idx) => {
            const isLastAssistant =
              m.role === "assistant" && idx === messages.length - 1;
            const textContent = m.parts
              .filter((p) => p.type === "text")
              .map((p) => (p as { type: "text"; text: string }).text)
              .join("");

            // Collect tool parts (AI SDK v6: type is `tool-${name}` or `dynamic-tool`)
            const toolParts = m.parts.filter(
              (p) => p.type.startsWith("tool-") || p.type === "dynamic-tool",
            ) as unknown[] as ToolUIPart[];

            // The actual tools this message executed — used to drive contextual
            // quick actions off real work done, not fuzzy text matching.
            const executedTools = m.parts
              .filter(
                (p) => p.type.startsWith("tool-") || p.type === "dynamic-tool",
              )
              .map((p) => {
                const tp = p as unknown as {
                  toolName?: string;
                  state?: string;
                  input?: unknown;
                  output?: unknown;
                };
                return {
                  name: tp.toolName ?? p.type.replace(/^tool-/, ""),
                  input: tp.input,
                  output:
                    tp.state === "output-available" ? tp.output : undefined,
                };
              });

            if (m.role === "user") {
              return (
                <div key={m.id} className="msg-row user">
                  <div className="msg-user-stack">
                    <div className="msg-user-bubble">{textContent}</div>
                    {textContent && (
                      <div className="msg-user-tools">
                        <button
                          type="button"
                          className="msg-inline-action"
                          disabled={isLoading || isWrongNetwork}
                          aria-label={`Retry prompt: ${textContent.slice(0, 80)}`}
                          title="Retry this prompt"
                          onClick={() => {
                            void submitPrompt(textContent);
                          }}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M2 6C2 3.8 3.8 2 6 2C7.4 2 8.6 2.7 9.3 3.8M10 6C10 8.2 8.2 10 6 10C4.6 10 3.4 9.3 2.7 8.2"
                              stroke="currentColor"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                            />
                            <path
                              d="M9 1.5V4H11.5"
                              stroke="currentColor"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="msg-timestamp">
                    {formatTime(new Date(messageTimeFor(m.id)))}
                  </div>
                </div>
              );
            }

            // Resolve the tracked status for this message's send-tx proposal (if
            // any) so the inline preview reflects live phase — tracking lives at
            // the account level now and survives conversation switches.
            const sendTxKey = (() => {
              for (const p of m.parts) {
                const part = p as {
                  type?: string;
                  state?: string;
                  output?: unknown;
                };
                if (
                  part.type?.includes("sendTransaction") &&
                  part.state === "output-available" &&
                  isTxProposalOutput(part.output)
                ) {
                  return part.output.proposal.idempotencyKey;
                }
              }
              return null;
            })();
            const inlineTxStatus = sendTxKey
              ? tracker.statusForKey(sendTxKey)
              : null;

            return (
              <div key={m.id} className="msg-row assistant">
                <div className="assistant-msg-wrapper">
                  <AssistantMessage
                    content={textContent}
                    toolParts={toolParts}
                    isStreaming={isLastAssistant && isStreaming}
                    txStatus={inlineTxStatus}
                  />
                  {isLastAssistant && !isLoading && !pendingProposal && (
                    <ContextualChips
                      tools={executedTools}
                      messageText={textContent}
                      onChipClick={handleContextualChip}
                      disabled={isWrongNetwork}
                    />
                  )}
                </div>
                <div className="msg-timestamp">
                  {formatTime(new Date(messageTimeFor(m.id)))}
                </div>
              </div>
            );
          })}

          {sessionNotices.map((notice) => (
            <div key={notice.id} className="msg-row assistant">
              <TxCompletionNotice notice={notice} />
              <div className="msg-timestamp">
                {formatTime(
                  new Date(notice.createdAt ?? messageTimeFor(notice.id)),
                )}
              </div>
            </div>
          ))}

          {/* Thinking dots */}
          {showThinking && (
            <div className="msg-row assistant">
              <div
                className="typing-indicator"
                role="status"
                aria-live="polite"
              >
                <span className="sr-only">Assistant is thinking</span>
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}

          {/* Retry */}
          {shouldShowRetry && (
            <div className="msg-row assistant">
              <div
                className="chat-error-banner"
                role="alert"
                aria-live="assertive"
              >
                <div className="chat-error-copy">
                  <div className="chat-error-title">Request failed</div>
                  <div className="chat-error-message">
                    {requestErrorMessage}
                  </div>
                </div>
                <button
                  className="retry-btn"
                  onClick={() => {
                    retriedRef.current = false;
                    setShowRetry(false);
                    regenerate();
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6C2 3.8 3.8 2 6 2C7.4 2 8.6 2.7 9.3 3.8M10 6C10 8.2 8.2 10 6 10C4.6 10 3.4 9.3 2.7 8.2"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9 1.5V4H11.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Retry request
                </button>
              </div>
            </div>
          )}

          <div className="chat-scroll-pad" />
        </div>

        <div className="chat-composer">
          <div className="chat-composer-inner">
            {isWrongNetwork && (
              <div className="network-warning">
                Switch to Sepolia to send messages
              </div>
            )}

            {quickActionDraft && (
              <QuickActionCard
                mode={quickActionDraft.mode}
                initialAddress={quickActionDraft.initialAddress}
                initialAmount={quickActionDraft.initialAmount}
                disabled={isLoading || isWrongNetwork}
                onCancel={() => setQuickActionDraft(null)}
                onSubmit={submitPrompt}
              />
            )}

            {pendingProposal &&
              !isWrongNetwork &&
              !quickActionDraft &&
              !isLoading && (
                <div className="suggestion-chips">
                  <button
                    type="button"
                    className="suggestion-chip suggestion-chip--confirm"
                    disabled={isLoading}
                    onClick={() => {
                      // Click the confirm button inside the modal directly
                      document
                        .querySelector<HTMLButtonElement>("#tx-confirm-btn")
                        ?.click();
                    }}
                  >
                    ✅ Confirm — {pendingProposal.valueEth} ETH →{" "}
                    {pendingProposal.to.slice(0, 6)}…
                    {pendingProposal.to.slice(-4)}
                  </button>
                  <button
                    type="button"
                    className="suggestion-chip"
                    disabled={isLoading}
                    onClick={() =>
                      setDismissedProposals((s) =>
                        new Set(s).add(pendingProposal.idempotencyKey),
                      )
                    }
                  >
                    ✕ Cancel
                  </button>
                </div>
              )}

            {!hasMessages && !pendingProposal && !isLoading && (
              <div className="suggestion-chips">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="suggestion-chip"
                    disabled={isLoading || isWrongNetwork}
                    onClick={() => {
                      void submitPrompt(s);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="chat-input-form">
              <div className="chat-textarea-wrapper">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // Simple address query detection (word after @ or 0x prefix)
                    const lastWord = e.target.value.split(/\s+/).pop() || "";
                    if (lastWord.startsWith("0x") || lastWord.includes("@")) {
                      setAddressSuggestionQuery(lastWord);
                    } else {
                      setAddressSuggestionQuery("");
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isWrongNetwork
                      ? "Switch to Sepolia first…"
                      : "Ask anything about your wallet…"
                  }
                  disabled={isWrongNetwork || isLoading}
                  className="chat-textarea"
                  rows={1}
                />
                {addressSuggestionQuery && (
                  <AddressSuggestions
                    query={addressSuggestionQuery}
                    isOpen={true}
                    onSelect={handleSelectAddressAlias}
                  />
                )}
              </div>
              <div className="chat-input-actions">
                <button
                  type="button"
                  className="sidebar-toggle-btn address-book-toggle-btn"
                  onClick={() => setAddressBookOpen(true)}
                  title="Address book"
                  aria-label="Address book"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle
                      cx="7"
                      cy="4.5"
                      r="2.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <path
                      d="M2 9.5C2 8 4.5 7 7 7C9.5 7 12 8 12 9.5V11.5C12 12.3 11.3 13 10.5 13H3.5C2.7 13 2 12.3 2 11.5V9.5Z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="sidebar-toggle-btn"
                  onClick={() => setSidebarOpen((o) => !o)}
                  title="Wallet info"
                  aria-label="Wallet panel"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect
                      x="1"
                      y="2"
                      width="12"
                      height="10"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <path d="M9 2V12" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </button>
                <button
                  type="submit"
                  disabled={isWrongNetwork || isLoading || !input.trim()}
                  className="send-btn"
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      className="spin"
                    >
                      <circle
                        cx="7"
                        cy="7"
                        r="5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="8 8"
                      />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </form>
            <div className="input-hint">
              Shift+Enter for new line · Enter to send
            </div>
          </div>
        </div>
      </div>

      {/* Address Book Panel */}
      <AddressBookPanel
        isOpen={addressBookOpen}
        onClose={() => setAddressBookOpen(false)}
        onSelectAlias={handleSelectAddressAlias}
      />

      {/* Wallet sidebar — desktop always visible, mobile overlay */}
      <div className={`wallet-sidebar ${sidebarOpen ? "open" : ""}`}>
        {/* Mobile close */}
        <button
          className="sidebar-close-btn"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close wallet sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 2L12 12M12 2L2 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <WalletSidebar
          address={address}
          isConnected={isConnected}
          auditEntries={auditEntries}
          balanceData={balanceData}
          balanceLoading={balanceLoading}
        />
      </div>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {pendingProposal && !isWrongNetwork && (
        <ConfirmTxModal
          proposal={pendingProposal}
          onClose={() =>
            setDismissedProposals((s) =>
              new Set(s).add(pendingProposal.idempotencyKey),
            )
          }
          onSubmitted={handleTxSubmitted}
          onLifecycleChange={handleTxLifecycleChange}
        />
      )}
    </div>
  );
}

function TxCompletionNotice({ notice }: { notice: TxNotice }) {
  const shortTo = `${notice.to.slice(0, 6)}…${notice.to.slice(-4)}`;
  const shortHash = `${notice.hash.slice(0, 10)}…${notice.hash.slice(-6)}`;
  const explorer = `https://sepolia.etherscan.io/tx/${notice.hash}`;
  const isConfirmed = notice.status === "confirmed";
  const isReverted = notice.status === "reverted";

  return (
    <div
      className={`tx-preview chat-tx-preview tx-complete-card ${notice.status}`}
    >
      <div className="tx-preview-label">
        {isConfirmed
          ? "Transaction confirmed"
          : isReverted
            ? "Transaction reverted"
            : "Confirmation delayed"}
      </div>

      <div className="tx-row">
        <span className="tx-label">Amount</span>
        <span className="tx-value accent">{notice.valueEth} ETH</span>
      </div>
      <div className="tx-row">
        <span className="tx-label">To</span>
        <span className="tx-value mono">{shortTo}</span>
      </div>
      <div className="tx-row">
        <span className="tx-label">Hash</span>
        <a
          href={explorer}
          target="_blank"
          rel="noopener noreferrer"
          className="tx-value accent mono"
        >
          {shortHash}
        </a>
      </div>

      {(notice.blockNumber ||
        notice.gasUsed ||
        notice.effectiveGasPriceGwei ||
        notice.txFeeEth) && (
        <div className="tx-receipt-grid">
          {notice.blockNumber && (
            <div className="tx-receipt-item">
              <span className="tx-label">Block</span>
              <span className="tx-value mono">#{notice.blockNumber}</span>
            </div>
          )}
          {notice.gasUsed && (
            <div className="tx-receipt-item">
              <span className="tx-label">Gas Used</span>
              <span className="tx-value mono">{notice.gasUsed}</span>
            </div>
          )}
          {notice.effectiveGasPriceGwei && (
            <div className="tx-receipt-item">
              <span className="tx-label">Gas Price</span>
              <span className="tx-value mono">
                {notice.effectiveGasPriceGwei} gwei
              </span>
            </div>
          )}
          {notice.txFeeEth && (
            <div className="tx-receipt-item">
              <span className="tx-label">Tx Fee</span>
              <span className="tx-value mono">{notice.txFeeEth} ETH</span>
            </div>
          )}
        </div>
      )}

      <div className={`tx-preview-status ${isConfirmed ? "done" : "error"}`}>
        {isConfirmed
          ? "Finalized on Sepolia"
          : isReverted
            ? "Reverted on Sepolia. Review wallet state before retrying"
            : "Still pending on-chain. Open explorer for live status"}
      </div>
    </div>
  );
}

function AssistantMessageSkeleton() {
  return (
    <div className="assistant-msg-wrapper" aria-hidden="true">
      <div className="msg-assistant-content">
        <div className="skeleton" style={{ width: "74%", height: 14 }} />
        <div
          className="skeleton"
          style={{ width: "92%", height: 14, marginTop: 8 }}
        />
      </div>
    </div>
  );
}

function WalletSidebarSkeleton() {
  return (
    <div className="sidebar-inner" aria-hidden="true">
      <div className="sidebar-section">
        <div className="sidebar-label">Wallet</div>
        <div className="skeleton" style={{ width: 120, height: 28 }} />
      </div>
      <div className="sidebar-section">
        <div className="sidebar-label">Balance</div>
        <div className="skeleton" style={{ width: 96, height: 24 }} />
      </div>
      <div className="sidebar-section sidebar-audit">
        <div className="sidebar-label">Audit Log</div>
        <div className="skeleton" style={{ width: "100%", height: 180 }} />
      </div>
    </div>
  );
}
