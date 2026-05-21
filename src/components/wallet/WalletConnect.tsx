"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect, useChainId } from "wagmi";
import { sepolia } from "viem/chains";
import { useEffect, useRef, useState } from "react";

export function WalletConnect() {
  const { openConnectModal } = useConnectModal();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const wrongNetwork = isConnected && chainId !== sepolia.id;
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (!isConnected) {
    return (
      <button
        type="button"
        className="wallet-btn"
        onClick={() => openConnectModal?.()}
      >
        Connect wallet
      </button>
    );
  }

  return (
    <div className="wallet-connect-wrap" ref={rootRef}>
      {wrongNetwork && <span className="pill warning">Wrong network</span>}
      <button
        type="button"
        className="wallet-btn wallet-btn-connected"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="wallet-status-dot" />
        <span className="mono">{short}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`wallet-chevron ${open ? "open" : ""}`}
          aria-hidden
        >
          <path
            d="M2 4L5 7L8 4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="wallet-menu" role="menu">
          <div className="wallet-menu-row">
            <span className="wallet-menu-label">Address</span>
            <span className="wallet-menu-value mono" title={address}>
              {short}
            </span>
          </div>
          <div className="wallet-menu-row">
            <span className="wallet-menu-label">Network</span>
            <span className="wallet-menu-value">Sepolia</span>
          </div>
          <button
            type="button"
            className="wallet-menu-action"
            role="menuitem"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
