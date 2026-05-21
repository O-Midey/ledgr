"use client";

import { ChatInterface } from "@/components/chat/ChatInterface";
import { WalletConnect } from "@/components/wallet/WalletConnect";

export default function WorkspacePage() {
  const handleClose = () => {
    window.close();
  };

  return (
    <div className="chat-root">
      <header className="chat-header">
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
          <span className="chat-title">Workspace</span>
          <span className="network-badge">
            <span className="network-dot" />
            Sepolia
          </span>
        </div>
        <WalletConnect />
      </header>
      <main className="chat-main">
        <ChatInterface />
      </main>
    </div>
  );
}
