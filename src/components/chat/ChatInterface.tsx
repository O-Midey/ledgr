"use client";

import dynamic from "next/dynamic";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import {
  useChainId,
  useAccount as useWagmiAccount,
  useBalance,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, formatUnits } from "viem";
import { sepolia } from "viem/chains";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { ToolUIPart, TxPreviewStatus } from "./TxPreviewCard";
import type { SuggestionChip } from "./ContextualChips";
import type { AddressAlias } from "@/lib/useAddressBook";
import { isTxProposalOutput, type TxProposal } from "@/lib/txProposal";
import { formatAuditForSidebar } from "@/audit/sessionStore";
import { generateId } from "@/lib/utils";

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

const TX_STATUS_STORAGE_KEY = "ledgr-tx-status";
const TX_NOTICES_STORAGE_KEY = "ledgr-tx-notices";
const SESSION_ID_STORAGE_KEY = "ledgr-chat-session-id";
const CHAT_MESSAGES_STORAGE_PREFIX = "ledgr-chat-messages:";

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
    const raw = sessionStorage.getItem(
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

function loadPersistedTxStatus(): TxBackgroundStatus | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TX_STATUS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TxBackgroundStatus;
    if (!parsed || !parsed.idempotencyKey || !parsed.to || !parsed.valueEth) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function loadPersistedTxNotices(): LocalTxNotice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TX_NOTICES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LocalTxNotice[];
  } catch {
    return [];
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

interface TxBackgroundStatus {
  hash?: `0x${string}`;
  to: string;
  valueEth: string;
  idempotencyKey: string;
  phase:
    | "signature_requested"
    | "submitted"
    | "confirming"
    | "confirmed"
    | "reverted"
    | "failed";
  startedAt?: number; // timestamp when entered "submitted" phase
  isStuck?: boolean; // true if in confirming >60s
}

interface LocalTxNotice {
  id: string;
  status: "confirmed" | "failed" | "reverted";
  hash: `0x${string}`;
  to: string;
  valueEth: string;
  blockNumber?: string;
  gasUsed?: string;
  effectiveGasPriceGwei?: string;
  txFeeEth?: string;
}

interface QuickActionDraft {
  mode: "send" | "gas";
  initialAddress?: string;
  initialAmount?: string;
}

function receiptMetrics(receipt: unknown): {
  blockNumber?: string;
  gasUsed?: string;
  effectiveGasPriceGwei?: string;
  txFeeEth?: string;
} {
  const r = receipt as {
    blockNumber?: bigint;
    gasUsed?: bigint;
    effectiveGasPrice?: bigint;
  };

  const blockNumber =
    typeof r?.blockNumber === "bigint" ? r.blockNumber.toString() : undefined;
  const gasUsed =
    typeof r?.gasUsed === "bigint" ? r.gasUsed.toString() : undefined;
  const effectiveGasPriceGwei =
    typeof r?.effectiveGasPrice === "bigint"
      ? Number(formatUnits(r.effectiveGasPrice, 9)).toFixed(2)
      : undefined;
  const txFeeEth =
    typeof r?.effectiveGasPrice === "bigint" && typeof r?.gasUsed === "bigint"
      ? Number(formatEther(r.effectiveGasPrice * r.gasUsed)).toFixed(6)
      : undefined;

  return { blockNumber, gasUsed, effectiveGasPriceGwei, txFeeEth };
}

// ── Main component ─────────────────────────────────────────────────────────

export function ChatInterface() {
  const { isConnected, address } = useWagmiAccount();
  const chainId = useChainId();
  const isWrongNetwork = isConnected && chainId !== sepolia.id;

  const { data: balanceData, isLoading: balanceLoading } = useBalance({
    address,
    chainId: sepolia.id,
    query: { enabled: isConnected && !!address },
  });

  const sessionId = useMemo(() => getOrCreateSessionId(), []);
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
  const { messages, sendMessage, status, error, regenerate } = useChat({
    id: sessionId,
    messages: persistedMessages,
    transport,
  });

  const [input, setInput] = useState("");
  const [showRetry, setShowRetry] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addressBookOpen, setAddressBookOpen] = useState(false);
  const [addressSuggestionQuery, setAddressSuggestionQuery] = useState("");
  const [dismissedProposals, setDismissedProposals] = useState<Set<string>>(
    () => new Set(),
  );
  const [serverAudit, setServerAudit] = useState<AuditEntry[]>([]);
  const [txStatus, setTxStatus] = useState<TxBackgroundStatus | null>(() =>
    loadPersistedTxStatus(),
  );
  const [txNotices, setTxNotices] = useState<LocalTxNotice[]>(() =>
    loadPersistedTxNotices(),
  );
  const [quickActionDraft, setQuickActionDraft] =
    useState<QuickActionDraft | null>(null);
  const retriedRef = useRef(false);
  const notifiedTxHashRef = useRef<string | null>(null);
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

  // ── Auto-retry on error ──
  useEffect(() => {
    if (error && !retriedRef.current) {
      retriedRef.current = true;
      regenerate();
    } else if (error && retriedRef.current) {
      setShowRetry(true);
    }
  }, [error, regenerate]);

  // ── Textarea auto-resize on input change (shrinks too) ──
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "36px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 36), 160)}px`;
  }, [input]);

  // ── Hydrate chat from server session on mount ──
  useEffect(() => {
    const hydrateFromServer = async () => {
      try {
        const res = await fetch("/api/session", {
          headers: { "x-session-id": sessionId },
        });
        if (!res.ok) return;
        const data = await res.json() as { messages?: UIMessage[]; auditEntries?: unknown[] };
        // If server has messages and we don't yet, hydrate
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 0 && messages.length === 0) {
          // The transport and useChat hooks handle merging with initial state
          // We rely on the server-backed session store to provide canonical history
        }
      } catch {
        /* network error during hydration; continue with empty */
      }
    };
    hydrateFromServer();
  }, [sessionId]);

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
          },
        },
      );
    },
    [isWrongNetwork, isLoading, sendMessage, address],
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
        sessionStorage.removeItem(key);
        return;
      }
      // Keep recent context only to avoid unbounded growth.
      sessionStorage.setItem(key, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
  }, [messages, sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (
        !txStatus ||
        txStatus.phase === "confirmed" ||
        txStatus.phase === "reverted" ||
        txStatus.phase === "failed"
      ) {
        localStorage.removeItem(TX_STATUS_STORAGE_KEY);
      } else {
        localStorage.setItem(TX_STATUS_STORAGE_KEY, JSON.stringify(txStatus));
      }
    } catch {
      /* ignore */
    }
  }, [txStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const recent = txNotices.slice(-20);
      localStorage.setItem(TX_NOTICES_STORAGE_KEY, JSON.stringify(recent));
    } catch {
      /* ignore */
    }
  }, [txNotices]);

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

  const pendingProposal = useMemo(
    () => findPendingProposal(messages, dismissedProposals),
    [messages, dismissedProposals],
  );

  const hasMessages = messages.length > 0;

  const txLiveAnnouncement = useMemo(() => {
    const latestNotice = txNotices[txNotices.length - 1];
    if (latestNotice) {
      if (latestNotice.status === "confirmed") {
        return `Transaction confirmed. ${latestNotice.valueEth} ETH sent to ${latestNotice.to}.`;
      }
      if (latestNotice.status === "reverted") {
        return "Transaction reverted on-chain.";
      }
      return "Transaction confirmation delayed.";
    }

    if (!txStatus) return "";
    if (txStatus.phase === "signature_requested") {
      return "Transaction signature requested in wallet.";
    }
    if (txStatus.phase === "submitted") {
      return "Transaction submitted to Sepolia.";
    }
    if (txStatus.phase === "confirming") {
      return txStatus.isStuck
        ? "Transaction is taking longer than usual to confirm."
        : "Waiting for on-chain confirmation.";
    }
    if (txStatus.phase === "failed") {
      return "Transaction confirmation failed.";
    }
    return "";
  }, [txStatus, txNotices]);

  const {
    isSuccess: txConfirmed,
    isError: txFailed,
    data: txReceipt,
  } = useWaitForTransactionReceipt({
    hash: txStatus?.hash,
    chainId: sepolia.id,
    query: {
      enabled:
        !!txStatus?.hash &&
        (txStatus?.phase === "submitted" || txStatus?.phase === "confirming"),
      retry: 5,
    },
  });

  useEffect(() => {
    if (!txStatus || txStatus.phase !== "submitted") return;
    const id = setTimeout(() => {
      setTxStatus((prev) =>
        prev && prev.phase === "submitted"
          ? {
              ...prev,
              phase: "confirming",
              startedAt: prev.startedAt || Date.now(),
            }
          : prev,
      );
    }, 700);
    return () => clearTimeout(id);
  }, [txStatus]);

  // Detect stuck tx (>60s in confirming)
  useEffect(() => {
    if (!txStatus || txStatus.phase !== "confirming" || !txStatus.startedAt)
      return;
    const checkStuck = setInterval(() => {
      setTxStatus((prev) => {
        if (!prev || prev.phase !== "confirming" || !prev.startedAt)
          return prev;
        const elapsedMs = Date.now() - prev.startedAt;
        const isStuckNow = elapsedMs > 60_000;
        return { ...prev, isStuck: isStuckNow };
      });
    }, 5000); // Check every 5s
    return () => clearInterval(checkStuck);
  }, [txStatus]);

  useEffect(() => {
    if (!txStatus || txStatus.phase !== "confirming") return;
    if (!txStatus.hash) return;
    if (!txConfirmed) return;

    if (txReceipt?.status === "reverted") {
      const metrics = receiptMetrics(txReceipt);
      const timeoutId = window.setTimeout(() => {
        setTxStatus((prev) => (prev ? { ...prev, phase: "reverted" } : prev));
        if (txStatus.hash && notifiedTxHashRef.current !== txStatus.hash) {
          notifiedTxHashRef.current = txStatus.hash;
          setTxNotices((prev) => [
            ...prev,
            {
              id: `failed-${txStatus.hash}`,
              status: "reverted",
              hash: txStatus.hash as `0x${string}`,
              to: txStatus.to,
              valueEth: txStatus.valueEth,
              ...metrics,
            },
          ]);
        }
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;

    (async () => {
      try {
        await fetch("/api/tx/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            hash: txStatus.hash,
            valueEth: txStatus.valueEth,
            to: txStatus.to,
            idempotencyKey: txStatus.idempotencyKey,
          }),
        });
      } catch {
        // Ignore, on-chain confirmation is source of truth.
      }

      if (!cancelled) {
        const metrics = receiptMetrics(txReceipt);
        setTxStatus((prev) =>
          prev && prev.hash === txStatus.hash
            ? { ...prev, phase: "confirmed" }
            : prev,
        );
        if (txStatus.hash && notifiedTxHashRef.current !== txStatus.hash) {
          notifiedTxHashRef.current = txStatus.hash;
          setTxNotices((prev) => [
            ...prev,
            {
              id: `confirmed-${txStatus.hash}`,
              status: "confirmed",
              hash: txStatus.hash as `0x${string}`,
              to: txStatus.to,
              valueEth: txStatus.valueEth,
              ...metrics,
            },
          ]);
        }
        refreshAudit();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [txConfirmed, txStatus, txReceipt, sessionId, refreshAudit]);

  useEffect(() => {
    if (!txStatus || txStatus.phase !== "confirming") return;
    if (!txStatus.hash) return;
    if (!txFailed) return;
    const timeoutId = window.setTimeout(() => {
      setTxStatus((prev) => (prev ? { ...prev, phase: "failed" } : prev));
      if (txStatus.hash && notifiedTxHashRef.current !== txStatus.hash) {
        notifiedTxHashRef.current = txStatus.hash;
        setTxNotices((prev) => [
          ...prev,
          {
            id: `failed-${txStatus.hash}`,
            status: "failed",
            hash: txStatus.hash as `0x${string}`,
            to: txStatus.to,
            valueEth: txStatus.valueEth,
          },
        ]);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [txFailed, txStatus]);

  const handleTxSubmitted = useCallback(
    (hash: `0x${string}`, proposal: TxProposal) => {
      if (pendingProposal) {
        setDismissedProposals((s) =>
          new Set(s).add(pendingProposal.idempotencyKey),
        );
      }
      setTxStatus({
        hash,
        to: proposal.to,
        valueEth: proposal.valueEth,
        idempotencyKey: proposal.idempotencyKey,
        phase: "submitted",
        startedAt: Date.now(),
      });
    },
    [pendingProposal],
  );

  const handleTxLifecycleChange = useCallback(
    (_phase: "signature_requested", proposal: TxProposal) => {
      setTxStatus((prev) => {
        if (prev && prev.idempotencyKey === proposal.idempotencyKey) {
          return { ...prev, phase: "signature_requested" };
        }
        return {
          hash: prev?.hash,
          to: proposal.to,
          valueEth: proposal.valueEth,
          idempotencyKey: proposal.idempotencyKey,
          phase: "signature_requested",
          startedAt: undefined,
          isStuck: false,
        };
      });
    },
    [],
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
              <div className="empty-state-title">
                Ledgr can carry out wallet actions on Sepolia.
              </div>
              <div className="empty-state-sub">
                {isConnected
                  ? `${address?.slice(0, 6)}…${address?.slice(-4)} · Sepolia`
                  : "Connect your wallet to check balances, estimate gas, send ETH on Sepolia, and inspect the audit trail."}
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

            if (m.role === "user") {
              return (
                <div key={m.id} className="msg-row user">
                  <div className="msg-user-bubble">{textContent}</div>
                  <div className="msg-timestamp">{formatTime(new Date())}</div>
                </div>
              );
            }

            return (
              <div key={m.id} className="msg-row assistant">
                <div className="msg-assistant-wrapper">
                  <AssistantMessage
                    content={textContent}
                    toolParts={toolParts}
                    isStreaming={isLastAssistant && isStreaming}
                    txStatus={txStatus as TxPreviewStatus | null}
                  />
                  {isLastAssistant && !isStreaming && (
                    <ContextualChips
                      messageText={textContent}
                      onChipClick={handleContextualChip}
                      disabled={isLoading || isWrongNetwork}
                    />
                  )}
                </div>
                <div className="msg-timestamp">{formatTime(new Date())}</div>
              </div>
            );
          })}

          {txNotices.map((notice) => (
            <div key={notice.id} className="msg-row assistant">
              <TxCompletionNotice notice={notice} />
              <div className="msg-timestamp">{formatTime(new Date())}</div>
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

            {!hasMessages && (
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
                  className="sidebar-toggle-btn"
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

function TxCompletionNotice({ notice }: { notice: LocalTxNotice }) {
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
