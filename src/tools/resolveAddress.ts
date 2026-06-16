import { z } from "zod";
import { isAddress } from "viem";
import { normalize } from "viem/ens";
import type { Address } from "viem";
import { getEnsClient } from "@/wallet/blockchainClient";

// Known alias → address map (extend as needed)
const ALIASES: Record<string, Address> = {};

export const resolveAddressSchema = z.object({
  alias: z.string().trim().min(1).max(100),
});

export type ResolveAddressInput = z.infer<typeof resolveAddressSchema>;

export const resolveAddressTool = {
  name: "resolveAddress" as const,
  description:
    'Resolve a human-readable alias (e.g. "alice") to an Ethereum address',
  schema: resolveAddressSchema,
  idempotent: true,
  sideEffects: false,

  async execute(
    input: ResolveAddressInput,
  ): Promise<{ alias: string; address: Address }> {
    const trimmed = input.alias.trim();

    // If the user already passed an address, return it directly
    if (isAddress(trimmed)) {
      return { alias: trimmed, address: trimmed as Address };
    }

    const lower = trimmed.toLowerCase();

    // ENS names resolve against mainnet (where ENS lives); the resolved address
    // is still used for Sepolia transactions.
    if (lower.endsWith(".eth")) {
      try {
        const address = await getEnsClient().getEnsAddress({
          name: normalize(trimmed),
        });
        if (address) {
          return { alias: trimmed, address };
        }
      } catch {
        // Fall through to the friendly error below.
      }
      throw new Error(
        `Could not resolve ENS name "${trimmed}". Double-check the name or provide a full 0x address.`,
      );
    }

    const resolved = ALIASES[lower];
    if (!resolved) {
      throw new Error(
        `Unknown alias: "${trimmed}". Please provide a full Ethereum address.`,
      );
    }

    return { alias: trimmed, address: resolved };
  },
};
