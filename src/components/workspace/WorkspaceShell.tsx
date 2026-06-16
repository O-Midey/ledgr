"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { useConversations } from "@/lib/useConversations";
import { ConversationsPanel } from "@/components/chat/ConversationsPanel";
import { TxPendingIndicator } from "@/lib/txTracker";

const ChatInterface = dynamic(
  () =>
    import("@/components/chat/ChatInterface").then((mod) => mod.ChatInterface),
  {
    ssr: false,
    loading: () => <WorkspaceChatSkeleton />,
  },
);

const WalletConnect = dynamic(
  () =>
    import("@/components/wallet/WalletConnect").then(
      (mod) => mod.WalletConnect,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="wallet-btn" aria-hidden="true">
        Loading wallet…
      </div>
    ),
  },
);

export function WorkspaceShell() {
  const router = useRouter();
  const [convOpen, setConvOpen] = useState(false);
  const {
    conversations,
    activeId,
    createConversation,
    switchConversation,
    deleteConversation,
    autoTitle,
    setTitle,
  } = useConversations();
  const [generatingTitleId, setGeneratingTitleId] = useState<string | null>(
    null,
  );

  const activeConversation = conversations.find((c) => c.id === activeId);
  const needsTitle =
    !activeConversation || activeConversation.title === "New conversation";

  const handleClose = () => {
    router.push("/");
  };

  const handleNewChat = useCallback(() => {
    createConversation();
    setConvOpen(false);
  }, [createConversation]);

  // Keyboard shortcuts: ⌘K / Ctrl+K toggles conversations, ⌘⇧O / Ctrl+Shift+O
  // starts a new chat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setConvOpen((o) => !o);
      } else if (e.shiftKey && key === "o") {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNewChat]);

  return (
    <div className="chat-root">
      <header className="chat-header">
        <div className="chat-header-inner">
          <div className="chat-header-left">
            <button type="button" className="chat-back" onClick={handleClose}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden
              >
                <path
                  d="M9 2L4 7L9 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back
            </button>
            <span className="chat-divider" />
            <button
              type="button"
              className="conv-toggle-btn"
              onClick={() => setConvOpen((o) => !o)}
              title="Conversations (⌘K)"
              aria-label="Conversations"
              aria-keyshortcuts="Meta+K Control+K"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden
              >
                <path
                  d="M2 3.5h10M2 7h7M2 10.5h5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="conv-toggle-label">Chats</span>
            </button>
            <span className="chat-divider" />
            <span className="network-badge">Sepolia</span>
            <TxPendingIndicator />
          </div>
          <div className="chat-header-right">
            <button
              type="button"
              className="chat-new-btn"
              onClick={handleNewChat}
              title="New conversation (⌘⇧O)"
              aria-keyshortcuts="Meta+Shift+O Control+Shift+O"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
              >
                <path
                  d="M6 1v10M1 6h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              New chat
            </button>
            <WalletConnect />
          </div>
        </div>
      </header>

      <ConversationsPanel
        isOpen={convOpen}
        conversations={conversations}
        activeId={activeId}
        generatingTitleId={generatingTitleId}
        onSwitch={switchConversation}
        onNew={handleNewChat}
        onDelete={deleteConversation}
        onRename={setTitle}
        onClose={() => setConvOpen(false)}
      />

      <div className="chat-root-inner">
        <main className="chat-main">
          {/* key forces a full remount when session changes — clean slate */}
          <ChatInterface
            key={activeId}
            sessionId={activeId}
            needsTitle={needsTitle}
            onTitleStart={() => setGeneratingTitleId(activeId)}
            onTitle={(title) => {
              autoTitle(activeId, title);
              setGeneratingTitleId((id) => (id === activeId ? null : id));
            }}
          />
        </main>
      </div>
    </div>
  );
}

function WorkspaceChatSkeleton() {
  return (
    <div className="chat-body" aria-hidden="true">
      <div className="chat-column">
        <div className="chat-messages">
          <div className="empty-state animate-fade-in">
            <div className="empty-state-title">Loading Ledgr workspace…</div>
            <div className="empty-state-sub">
              Preparing chat, wallet state, and Sepolia safety checks.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
