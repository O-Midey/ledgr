"use client";

import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { ArchitectureSection } from "@/components/landing/ArchitectureSection";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { CtaSection } from "@/components/landing/CtaSection";
import { LandingNav } from "@/components/landing/LandingNav";

export default function Home() {
  const handleOpenWorkspace = () => {
    window.open("/workspace", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="landing-page">
      <LandingNav onOpenWorkspace={handleOpenWorkspace} />
      <main>
        <HeroSection onOpenWorkspace={handleOpenWorkspace} />
        <FeaturesSection />
        <ArchitectureSection />
        <SecuritySection />
        <CtaSection onLaunch={handleOpenWorkspace} />
      </main>
      <footer className="landing-footer">
        <span className="brand-name">
          Ledgr<span className="brand-name-accent">.</span>
        </span>
        <span className="landing-footer-meta">
          AI Wallet OS · Sepolia · v0.1.0
        </span>
      </footer>
    </div>
  );
}
