"use client";

import { useState } from "react";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { ArchitectureSection } from "@/components/landing/ArchitectureSection";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { CtaSection } from "@/components/landing/CtaSection";
import { LandingNav } from "@/components/landing/LandingNav";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { WalletConnect } from "@/components/wallet/WalletConnect";

export default function Home() {
  const [showChat, setShowChat] = useState(false);

  if (showChat) {
    return <ChatPage onBack={() => setShowChat(false)} />;
  }

  return (
    <div className="landing-page">
      <LandingNav onOpenWorkspace={() => setShowChat(true)} />
      <main>
        <HeroSection onOpenWorkspace={() => setShowChat(true)} />
        <FeaturesSection />
        <ArchitectureSection />
        <SecuritySection />
        <CtaSection onLaunch={() => setShowChat(true)} />
      </main>
      <footer className="landing-footer">
        <span className="brand-name">Ledgr</span>
        <span className="landing-footer-meta">AI Wallet OS · Sepolia · v0.1.0</span>
      </footer>
    </div>
  );
}

function ChatPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="chat-root">
      <header className="chat-header">
        <div className="chat-header-left">
          <button type="button" className="chat-back" onClick={onBack}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
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
