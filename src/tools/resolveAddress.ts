import { z } from "zod";
import { isAddress } from "viem";
import type { Address } from "viem";

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
    const resolved = ALIASES[lower];

    if (!resolved) {
      throw new Error(
        `Unknown alias: "${trimmed}". Please provide a full Ethereum address.`,
      );
    }

    return { alias: trimmed, address: resolved };
  },
};
