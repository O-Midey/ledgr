import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Server-side wallet client for the agent demo wallet.
 * The app never receives user private keys — this is for the test/demo wallet only.
 * Lazy-initialized to avoid crashing at import time when env var is absent.
 */
let _walletClient: ReturnType<typeof createWalletClient> | null = null;

export function getAgentWalletClient(): ReturnType<typeof createWalletClient> {
  if (_walletClient) return _walletClient;

  const privateKey = process.env.WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "WALLET_PRIVATE_KEY environment variable is required for agent demo wallet",
    );
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  _walletClient = createWalletClient({
    account,
    transport: http(process.env.ALCHEMY_RPC_URL),
  });

  return _walletClient;
}

export function getAgentAddress(): `0x${string}` {
  const privateKey = process.env.WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("WALLET_PRIVATE_KEY environment variable is required");
  }
  return privateKeyToAccount(privateKey as `0x${string}`).address;
}
