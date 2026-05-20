import { formatEther, isAddress } from "viem";
import type { Address } from "viem";
import { SEPOLIA_EXPLORER_BASE } from "./constants";

export function txExplorerUrl(hash: string): string {
  return `${SEPOLIA_EXPLORER_BASE}/tx/${hash}`;
}

export function addressExplorerUrl(address: string): string {
  return `${SEPOLIA_EXPLORER_BASE}/address/${address}`;
}

export function truncateAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function weiToEth(wei: bigint): string {
  return formatEther(wei);
}

export function assertAddress(value: unknown): Address {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error(`Invalid Ethereum address: ${String(value)}`);
  }
  return value as Address;
}

export function nowMs(): number {
  return Date.now();
}

export function generateId(): string {
  return crypto.randomUUID();
}

/** Redact sensitive patterns from a string before logging or streaming */
export function redactSensitive(input: string): string {
  // Private key pattern (0x + 64 hex chars)
  let out = input.replace(/0x[0-9a-fA-F]{64}/g, "[REDACTED_KEY]");
  // Generic long hex secrets (e.g. API keys)
  out = out.replace(/[0-9a-fA-F]{40,}/g, (match) => {
    // Preserve valid-looking tx hashes/addresses but redact longer blobs
    if (match.length === 40 || match.length === 64) return match;
    return "[REDACTED_HEX]";
  });
  // Common env var leak patterns
  out = out.replace(
    /(OPENAI_API_KEY|ANTHROPIC_API_KEY|ALCHEMY_API_KEY|WALLET_PRIVATE_KEY)\s*=\s*\S+/gi,
    "$1=[REDACTED]",
  );
  return out;
}
