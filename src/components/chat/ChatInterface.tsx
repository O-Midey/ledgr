"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  useChainId,
  useAccount as useWagmiAccount,
  useBalance,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, formatUnits } from "viem";
import { sepolia } from "viem/chains";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  ActivityTrace,
  TxPreviewCard,
  type ToolUIPart,
  type TxPreviewStatus,
} from "./TxPreviewCard";
import { ConfirmTxModal } from "./ConfirmTxModal";
import { AddressBookPanel } from "./AddressBookPanel";
import { AddressSuggestions } from "./AddressSuggestions";
import { ContextualChips } from "./ContextualChips";
import type { AddressAlias } from "@/lib/useAddressBook";
import { isTxProposalOutput, type TxProposal } from "@/lib/txProposal";
import { formatAuditForSidebar } from "@/audit/sessionStore";
import { generateId } from "@/lib/utils";

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
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "The request did not complete. Please try again.";
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

  const sessionId = useMemo(() => generateId(), []);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: { "x-session-id": sessionId },
      }),
    [sessionId],
  );
  const { messages, sendMessage, status, error, regenerate } = useChat({
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
  const [txStatus, setTxStatus] = useState<TxBackgroundStatus | null>(null);
  const [txNotices, setTxNotices] = useState<LocalTxNotice[]>([]);
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

  const submitPrompt = useCallback(
    async (text: string) => {
      const normalizedText = text.trim();
      if (!normalizedText || isWrongNetwork || isLoading) return;

      retriedRef.current = false;
      setShowRetry(false);
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
      refreshAudit();
    }
  }, [status, messages, refreshAudit]);

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
  }, [txStatus?.phase]);

  useEffect(() => {
    if (!txStatus || txStatus.phase !== "confirming") return;
    if (!txStatus.hash) return;
    if (!txConfirmed) return;

    if (txReceipt?.status === "reverted") {
      const metrics = receiptMetrics(txReceipt);
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
      return;
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
                How can I help with your wallet?
              </div>
              <div className="empty-state-sub">
                {isConnected
                  ? `${address?.slice(0, 6)}…${address?.slice(-4)} · Sepolia`
                  : "Connect your wallet to check balances, simulate transfers, and review audit logs."}
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
                      onChipClick={submitPrompt}
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

// ── AssistantMessage ───────────────────────────────────────────────────────

function AssistantMessage({
  content,
  toolParts,
  isStreaming,
  txStatus,
}: {
  content: string;
  toolParts: ToolUIPart[];
  isStreaming: boolean;
  txStatus: TxPreviewStatus | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [content]);

  const previewTools = toolParts.filter((tp) => {
    const name = tp.toolName ?? tp.type.replace(/^tool-/, "");
    return name === "estimateGas" || name === "sendTransaction";
  });

  const badgeTools = toolParts.filter((tp) => {
    const name = tp.toolName ?? tp.type.replace(/^tool-/, "");
    return name !== "estimateGas" && name !== "sendTransaction";
  });

  return (
    <div className="assistant-msg-wrapper">
      <div className="msg-assistant-content">
        <ReactMarkdown>{content}</ReactMarkdown>
        {isStreaming && <span className="stream-cursor">▋</span>}
      </div>

      {badgeTools.length > 0 && (
        <div className="preview-tools">
          {badgeTools.map((tp, i) => {
            const toolName = tp.toolName ?? tp.type.replace(/^tool-/, "");
            const state = tp.state;
            const cls =
              state === "output-available"
                ? "done"
                : state === "output-error"
                  ? "error"
                  : "running";
            const icon =
              state === "output-available"
                ? "✓"
                : state === "output-error"
                  ? "✕"
                  : "…";
            return (
              <span key={i} className={`tool-badge ${cls}`}>
                {icon} {toolName}
              </span>
            );
          })}
        </div>
      )}

      {previewTools.map((tp) => (
        <TxPreviewCard key={tp.toolCallId} part={tp} txStatus={txStatus} />
      ))}

      <ActivityTrace toolParts={toolParts} />

      {content && (
        <div className="msg-actions">
          <button
            className="msg-action-btn"
            onClick={handleCopy}
            title="Copy"
            type="button"
          >
            {copied ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6L5 9L10 3"
                  stroke="var(--success)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect
                  x="1"
                  y="3"
                  width="7"
                  height="8"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
                <path
                  d="M4 3V2C4 1.4 4.4 1 5 1H10C10.6 1 11 1.4 11 2V7C11 7.6 10.6 8 10 8H9"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
              </svg>
            )}
          </button>
        </div>
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

// ── WalletSidebar ──────────────────────────────────────────────────────────

function WalletSidebar({
  address,
  isConnected,
  auditEntries,
  balanceData,
  balanceLoading,
}: {
  address?: string;
  isConnected: boolean;
  auditEntries: AuditEntry[];
  balanceData?: { formatted: string; symbol: string } | null;
  balanceLoading: boolean;
}) {
  const shortAddr = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;
  const [copied, setCopied] = useState(false);
  const [toolFilter, setToolFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<
    "none" | "tool" | "severity" | "event"
  >("severity");

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toolOptions = useMemo(
    () =>
      Array.from(new Set(auditEntries.map((e) => e.toolName).filter(Boolean))),
    [auditEntries],
  );
  const eventOptions = useMemo(
    () => Array.from(new Set(auditEntries.map((e) => e.eventType))),
    [auditEntries],
  );

  const filteredAuditEntries = useMemo(
    () =>
      auditEntries.filter((e) => {
        if (toolFilter !== "all" && e.toolName !== toolFilter) return false;
        if (severityFilter !== "all" && e.severity !== severityFilter)
          return false;
        if (eventFilter !== "all" && e.eventType !== eventFilter) return false;
        return true;
      }),
    [auditEntries, toolFilter, severityFilter, eventFilter],
  );

  const groupedAuditEntries = useMemo(() => {
    if (groupBy === "none") {
      return [{ label: "All", entries: filteredAuditEntries }];
    }

    const bucket = new Map<string, AuditEntry[]>();
    for (const entry of filteredAuditEntries) {
      const key =
        groupBy === "tool"
          ? (entry.toolName ?? "unknown")
          : groupBy === "severity"
            ? entry.severity
            : entry.eventType;
      const current = bucket.get(key) ?? [];
      current.push(entry);
      bucket.set(key, current);
    }

    return Array.from(bucket.entries()).map(([label, entries]) => ({
      label,
      entries,
    }));
  }, [filteredAuditEntries, groupBy]);

  return (
    <div className="sidebar-inner">
      {/* Wallet */}
      <div className="sidebar-section">
        <div className="sidebar-label">Wallet</div>
        {isConnected && address ? (
          <>
            <button
              className="address-chip"
              title={copied ? "Copied!" : address}
              onClick={copyAddress}
            >
              {copied ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5L4.5 7.5L8.5 2.5"
                    stroke="var(--success)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect
                    x="1"
                    y="3"
                    width="6"
                    height="6"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <path
                    d="M3 3V2C3 1.4 3.4 1 4 1H8C8.6 1 9 1.4 9 2V6C9 6.6 8.6 7 8 7H7"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                </svg>
              )}
              {shortAddr}
            </button>
            <div style={{ marginTop: 8 }}>
              <div className="network-badge">
                <span className="network-dot" />
                Sepolia
              </div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Not connected
          </div>
        )}
      </div>

      {/* Live balance */}
      <div className="sidebar-section">
        <div className="sidebar-label">Balance</div>
        {isConnected ? (
          balanceLoading ? (
            <div>
              <div
                className="skeleton"
                style={{ width: 80, height: 22, marginBottom: 4 }}
              />
              <div className="skeleton" style={{ width: 50, height: 12 }} />
            </div>
          ) : (
            <>
              <div className="balance-display">
                {balanceData
                  ? parseFloat(balanceData.formatted).toFixed(4)
                  : "—"}
              </div>
              <div className="balance-sub">
                {balanceData?.symbol ?? "ETH"} · Sepolia
              </div>
            </>
          )
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Connect wallet
          </div>
        )}
      </div>

      {/* Network */}
      <div className="sidebar-section">
        <div className="sidebar-label">Network</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { label: "Chain", value: "Sepolia" },
            { label: "Chain ID", value: "11155111" },
            { label: "RPC", value: "Alchemy" },
          ].map((r) => (
            <div
              key={r.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
              }}
            >
              <span style={{ color: "var(--text-3)" }}>{r.label}</span>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono)",
                  color: "var(--text-2)",
                }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Audit log — scrollable, bounded */}
      <div className="sidebar-section sidebar-audit">
        <div className="sidebar-label">Audit Log</div>
        <div className="audit-controls">
          <select
            className="audit-select"
            value={toolFilter}
            onChange={(e) => setToolFilter(e.target.value)}
          >
            <option value="all">All tools</option>
            {toolOptions.map((tool) => (
              <option key={tool} value={tool}>
                {tool}
              </option>
            ))}
          </select>
          <select
            className="audit-select"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="all">All severity</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
          <select
            className="audit-select"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          >
            <option value="all">All events</option>
            {eventOptions.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
          <select
            className="audit-select"
            value={groupBy}
            onChange={(e) =>
              setGroupBy(
                e.target.value as "none" | "tool" | "severity" | "event",
              )
            }
          >
            <option value="severity">Group: severity</option>
            <option value="tool">Group: tool</option>
            <option value="event">Group: event</option>
            <option value="none">No grouping</option>
          </select>
        </div>
        <div className="audit-scroll">
          {filteredAuditEntries.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              No activity yet
            </div>
          ) : (
            groupedAuditEntries.map((group) => (
              <div key={group.label} className="audit-group">
                {groupBy !== "none" && (
                  <div className="audit-group-label">{group.label}</div>
                )}
                {group.entries.map((e, i) => (
                  <details
                    key={`${group.label}-${i}-${e.time}`}
                    className="audit-entry"
                  >
                    <summary className="audit-entry-summary">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background:
                              e.status === "success"
                                ? "var(--success)"
                                : e.status === "running"
                                  ? "var(--accent)"
                                  : "var(--danger)",
                            animation:
                              e.status === "running"
                                ? "pulse-dot 1.5s ease-in-out infinite"
                                : "none",
                          }}
                        />
                        <span className="audit-action">{e.action}</span>
                      </div>
                      <span className="audit-time">{e.time}</span>
                    </summary>
                    <div className="audit-entry-details">
                      <div className="audit-meta-row">
                        <span>event</span>
                        <span>{e.eventType}</span>
                      </div>
                      <div className="audit-meta-row">
                        <span>severity</span>
                        <span>{e.severity}</span>
                      </div>
                      {e.toolName && (
                        <div className="audit-meta-row">
                          <span>tool</span>
                          <span>{e.toolName}</span>
                        </div>
                      )}
                      {e.hash && (
                        <div className="audit-meta-row">
                          <span>hash</span>
                          <span className="audit-hash">{`${e.hash.slice(0, 10)}…${e.hash.slice(-8)}`}</span>
                        </div>
                      )}
                      {e.previousHash && (
                        <div className="audit-meta-row">
                          <span>prev</span>
                          <span className="audit-hash">{`${e.previousHash.slice(0, 10)}…${e.previousHash.slice(-8)}`}</span>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Safety — always visible at bottom */}
      <div className="sidebar-section sidebar-safety">
        <div className="sidebar-label">Safety</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {[
            { label: "Simulation", ok: true },
            { label: "Supervisor", ok: true },
            { label: "Audit Log", ok: true },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 11,
              }}
            >
              <span style={{ color: "var(--text-3)" }}>{s.label}</span>
              <span
                style={{
                  color: s.ok ? "var(--success)" : "var(--danger)",
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: 10,
                }}
              >
                {s.ok ? "active" : "off"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
