import { createPublicClient, http } from "viem";

if (!process.env.ALCHEMY_RPC_URL) {
  throw new Error("ALCHEMY_RPC_URL environment variable is required");
}

/**
 * Read-only public client for Sepolia.
 * Used by all read tools (getBalance, estimateGas, getTransactionHistory).
 */
export const publicClient = createPublicClient({
  transport: http(process.env.ALCHEMY_RPC_URL),
});
