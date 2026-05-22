"use client";

import dynamic from "next/dynamic";

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
  const handleClose = () => {
    window.close();
  };

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
              Close
            </button>
            <span className="chat-divider" />
            <span className="network-badge">Sepolia</span>
          </div>
          <WalletConnect />
        </div>
      </header>
      <div className="chat-root-inner">
        <main className="chat-main">
          <ChatInterface />
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
        <div className="chat-composer">
          <div className="chat-composer-inner">
            <div className="chat-input-form">
              <div className="chat-textarea-wrapper">
                <div
                  className="skeleton"
                  style={{ width: "100%", height: 44 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
