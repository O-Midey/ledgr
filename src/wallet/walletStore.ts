"use client";

import { create } from "zustand";
import type { WalletState } from "@/types/wallet";
import type { Address } from "viem";

interface WalletStore extends WalletState {
  setConnected: (address: Address, chainId: number) => void;
  setDisconnected: () => void;
  setChainId: (chainId: number) => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  address: null,
  chainId: null,
  isConnected: false,
  mode: "connected",

  setConnected: (address, chainId) =>
    set({ address, chainId, isConnected: true, mode: "connected" }),

  setDisconnected: () =>
    set({ address: null, chainId: null, isConnected: false }),

  setChainId: (chainId) => set({ chainId }),
}));
