import { createPublicClient, http } from "viem";
import { mainnet, sepolia } from "viem/chains";

if (!process.env.ALCHEMY_RPC_URL) {
  throw new Error("ALCHEMY_RPC_URL environment variable is required");
}

/**
 * Read-only public client for Sepolia.
 * Used by all read tools (getBalance, estimateGas, getTransactionHistory).
 */
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.ALCHEMY_RPC_URL),
});

/**
 * Read-only mainnet client used ONLY for ENS resolution — ENS records live on
 * mainnet, while resolved addresses are still transacted with on Sepolia.
 * Lazily created so the app never requires a mainnet RPC unless ENS is used;
 * falls back to a public RPC when no Alchemy key is configured.
 */
let _ensClient: ReturnType<typeof createPublicClient> | null = null;

export function getEnsClient(): ReturnType<typeof createPublicClient> {
  if (_ensClient) return _ensClient;

  const key = process.env.ALCHEMY_API_KEY;
  const url = key
    ? `https://eth-mainnet.g.alchemy.com/v2/${key}`
    : "https://ethereum-rpc.publicnode.com";

  _ensClient = createPublicClient({
    chain: mainnet,
    transport: http(url),
  });
  return _ensClient;
}
