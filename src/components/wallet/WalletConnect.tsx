"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import { sepolia } from "viem/chains";

/** Wallet connect button with persistent wrong-network warning. */
export function WalletConnect() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const isWrongNetwork = isConnected && chainId !== sepolia.id;

  return (
    <div className="wallet-connect">
      <ConnectButton />
      {isWrongNetwork && (
        <div role="alert" className="network-warning">
          ⚠️ Wrong network detected. Please switch to <strong>Sepolia</strong>{" "}
          to use Ledgr.
        </div>
      )}
    </div>
  );
}
