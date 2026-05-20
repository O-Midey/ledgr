"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useChainId } from "wagmi";
import { sepolia } from "viem/chains";
import { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { useAccount as useWagmiAccount } from "wagmi";

function buildTransport(address: string | undefined) {
  return new DefaultChatTransport({
    api: "/api/chat",
    headers: address ? { "x-wallet-address": address } : {},
  });
}

/** Main chat interface. Blocks send when wallet is on wrong network. */
export function ChatInterface() {
  const { isConnected, address } = useWagmiAccount();
  const chainId = useChainId();
  const isWrongNetwork = isConnected && chainId !== sepolia.id;

  // Rebuild transport only when address changes
  const transport = useMemo(() => buildTransport(address), [address]);

  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport,
  });

  const [input, setInput] = useState("");
  const [showRetryButton, setShowRetryButton] = useState(false);
  const retriedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isLoading = status === "streaming" || status === "submitted";
  // Only show thinking bubble while submitted and no messages have streamed yet
  const lastMessageIsUser =
    messages.length > 0 && messages[messages.length - 1].role === "user";
  const showThinking = isLoading && lastMessageIsUser;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (error && !retriedRef.current) {
      retriedRef.current = true;
      regenerate();
    } else if (error && retriedRef.current) {
      setShowRetryButton(true);
    }
  }, [error, regenerate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isWrongNetwork || isLoading) return;
    const text = input;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Message list */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p style={{ fontSize: 20, fontWeight: 700 }}>Ledgr</p>
            <p>Your Sepolia wallet assistant</p>
            <div className="suggestion-chips">
              {[
                "Check my balance",
                "Send 0.01 ETH",
                "Show recent transactions",
                "What is ETH price?",
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setInput(chip)}
                  className="suggestion-chip"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const textContent = m.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("");
          return (
            <div key={m.id} className={`message ${m.role}`}>
              <div className="message-bubble">
                {m.role === "assistant" ? (
                  <ReactMarkdown>{textContent}</ReactMarkdown>
                ) : (
                  textContent
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking bubble: show while waiting for first response */}
        {showThinking && (
          <div className="message assistant">
            <div className="message-bubble">Thinking…</div>
          </div>
        )}

        {showRetryButton && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              onClick={() => {
                retriedRef.current = false;
                setShowRetryButton(false);
                regenerate();
              }}
              style={{
                fontSize: 12,
                color: "#ef4444",
                textDecoration: "underline",
              }}
            >
              Retry failed — click to try again
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="chat-input-area">
        {isWrongNetwork && (
          <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>
            Switch to Sepolia before sending messages.
          </p>
        )}
        <div className="input-form">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isWrongNetwork
                ? "Switch to Sepolia first…"
                : "Ask anything about your wallet…"
            }
            disabled={isWrongNetwork || isLoading}
            className="input-field"
          />
          <button
            type="submit"
            disabled={isWrongNetwork || isLoading || !input.trim()}
            className="send-button"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
