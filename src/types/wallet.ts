import type { Address, Hash } from "viem";

export type SupportedToken = "ETH";

export type WalletMode = "connected" | "agent_demo";

export interface WalletState {
  readonly address: Address | null;
  readonly chainId: number | null;
  readonly isConnected: boolean;
  readonly mode: WalletMode;
}

export interface TransactionRequest {
  readonly to: Address;
  readonly value: bigint;
  readonly data?: `0x${string}`;
  readonly from: Address;
}

export interface TransactionReceipt {
  readonly hash: Hash;
  readonly from: Address;
  readonly to: Address;
  readonly value: bigint;
  readonly gasUsed: bigint;
  readonly status: "success" | "reverted";
  readonly blockNumber: bigint;
  readonly explorerUrl: string;
}

export interface TokenBalance {
  readonly token: SupportedToken;
  readonly address: Address;
  readonly balanceWei: bigint;
  readonly balanceEth: string;
}

export interface TransferEvent {
  readonly hash: Hash;
  readonly from: Address;
  readonly to: Address;
  readonly value: bigint;
  readonly valueEth: string;
  readonly blockNumber: bigint;
  readonly timestamp: number | null;
  readonly direction: "inbound" | "outbound";
}

export interface GasEstimate {
  readonly gasUnits: bigint;
  readonly gasPriceWei: bigint;
  readonly totalCostWei: bigint;
  readonly totalCostEth: string;
}
