import { ChatInterface } from "@/components/chat/ChatInterface";
import { WalletConnect } from "@/components/wallet/WalletConnect";

export default function Home() {
  return (
    <div className="chat-container">
      {/* Header */}
      <header className="chat-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="chat-title">Ledgr</span>
          <span className="network-badge">Sepolia</span>
        </div>
        <WalletConnect />
      </header>

      {/* Chat */}
      <main style={{ flex: 1, overflow: "hidden" }}>
        <ChatInterface />
      </main>
    </div>
  );
}
