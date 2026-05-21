"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  useChainId,
  useAccount as useWagmiAccount,
  useBalance,
  useWaitForTransactionReceipt,
} from "wagmi";
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
import { isTxProposalOutput, type TxProposal } from "@/lib/txProposal";
import { formatAuditForSidebar } from "@/audit/sessionStore";
import { generateId } from "@/lib/utils";

function buildTransport(address: string | undefined, sessionId: string) {
  const headers: Record<string, string> = { "x-session-id": sessionId };
  if (address) headers["x-wallet-address"] = address;
  return new DefaultChatTransport({ api: "/api/chat", headers });
}

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

// ── Types ──────────────────────────────────────────────────────────────────

interface AuditEntry {
  action: string;
  time: string;
  status: "success" | "running" | "error";
  duration?: string;
}

interface TxBackgroundStatus {
  hash: `0x${string}`;
  to: string;
  valueEth: string;
  idempotencyKey: string;
  status: "confirming" | "confirmed" | "failed";
}

interface LocalTxNotice {
  id: string;
  text: string;
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
    () => buildTransport(address, sessionId),
    [address, sessionId],
  );
  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport,
  });

  const [input, setInput] = useState("");
  const [showRetry, setShowRetry] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dismissedProposals, setDismissedProposals] = useState<Set<string>>(
    () => new Set(),
  );
  const [serverAudit, setServerAudit] = useState<
    { action: string; time: string; status: "success" | "running" | "error" }[]
  >([]);
  const [txStatus, setTxStatus] = useState<TxBackgroundStatus | null>(null);
  const [txNotices, setTxNotices] = useState<LocalTxNotice[]>([]);
  const retriedRef = useRef(false);
  const notifiedTxHashRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);

  const isLoading = status === "streaming" || status === "submitted";
  const isStreaming = status === "streaming";
  const lastIsUser =
    messages.length > 0 && messages[messages.length - 1].role === "user";
  const showThinking = status === "submitted" && lastIsUser;

  // ── Smart auto-scroll: only if user is near bottom ──
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, showThinking]);

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

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isWrongNetwork || isLoading) return;
      const text = input;
      setInput("");
      isNearBottomRef.current = true;
      await sendMessage({ text });
    },
    [input, isWrongNetwork, isLoading, sendMessage],
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

  const { isSuccess: txConfirmed, isError: txFailed } =
    useWaitForTransactionReceipt({
      hash: txStatus?.hash,
      chainId: sepolia.id,
      query: {
        enabled: txStatus?.status === "confirming",
        pollingInterval: 1200,
        retry: 5,
      },
    });

  useEffect(() => {
    if (!txStatus || txStatus.status !== "confirming") return;
    if (!txConfirmed) return;

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
        setTxStatus((prev) =>
          prev && prev.hash === txStatus.hash
            ? { ...prev, status: "confirmed" }
            : prev,
        );
        if (notifiedTxHashRef.current !== txStatus.hash) {
          notifiedTxHashRef.current = txStatus.hash;
          setTxNotices((prev) => [
            ...prev,
            {
              id: `confirmed-${txStatus.hash}`,
              text:
                `✅ Transaction confirmed on Sepolia.\n\n` +
                `• Amount: ${txStatus.valueEth} ETH\n` +
                `• Recipient: ${txStatus.to}\n` +
                `• Hash: ${txStatus.hash}\n` +
                `• Explorer: https://sepolia.etherscan.io/tx/${txStatus.hash}`,
            },
          ]);
        }
        refreshAudit();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [txConfirmed, txStatus, sessionId, refreshAudit]);

  useEffect(() => {
    if (!txStatus || txStatus.status !== "confirming") return;
    if (!txFailed) return;
    setTxStatus((prev) => (prev ? { ...prev, status: "failed" } : prev));
    if (notifiedTxHashRef.current !== txStatus.hash) {
      notifiedTxHashRef.current = txStatus.hash;
      setTxNotices((prev) => [
        ...prev,
        {
          id: `failed-${txStatus.hash}`,
          text:
            `⚠️ We couldn't confirm this transaction yet.\n\n` +
            `• Amount: ${txStatus.valueEth} ETH\n` +
            `• Recipient: ${txStatus.to}\n` +
            `• Hash: ${txStatus.hash}\n` +
            `• Check: https://sepolia.etherscan.io/tx/${txStatus.hash}`,
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
        status: "confirming",
      });
    },
    [pendingProposal],
  );

  return (
    <div className="chat-body">
      <div className="chat-column">
        <div className="chat-messages" ref={scrollRef} onScroll={handleScroll}>
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
                <AssistantMessage
                  content={textContent}
                  toolParts={toolParts}
                  isStreaming={isLastAssistant && isStreaming}
                  txStatus={txStatus as TxPreviewStatus | null}
                />
                <div className="msg-timestamp">{formatTime(new Date())}</div>
              </div>
            );
          })}

          {txNotices.map((notice) => (
            <div key={notice.id} className="msg-row assistant">
              <AssistantMessage
                content={notice.text}
                toolParts={[]}
                isStreaming={false}
                txStatus={null}
              />
              <div className="msg-timestamp">{formatTime(new Date())}</div>
            </div>
          ))}

          {/* Thinking dots */}
          {showThinking && (
            <div className="msg-row assistant">
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}

          {/* Retry */}
          {showRetry && (
            <div className="msg-row assistant">
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
                Request failed — click to retry
              </button>
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
                    onClick={() => setInput(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="chat-input-form">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
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
              <div className="chat-input-actions">
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

      {/* Wallet sidebar — desktop always visible, mobile overlay */}
      <div className={`wallet-sidebar ${sidebarOpen ? "open" : ""}`}>
        {/* Mobile close */}
        <button
          className="sidebar-close-btn"
          onClick={() => setSidebarOpen(false)}
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

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
        <div className="audit-scroll">
          {auditEntries.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              No activity yet
            </div>
          ) : (
            auditEntries.map((e, i) => (
              <div key={i} className="audit-entry">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
