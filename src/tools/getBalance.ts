import { z } from "zod";
import { isAddress } from "viem";
import { publicClient } from "@/wallet/blockchainClient";
import { weiToEth } from "@/lib/utils";
import type { TokenBalance } from "@/types/wallet";
import type { Address } from "viem";

export const getBalanceSchema = z.object({
  address: z
    .string()
    .trim()
    .min(42)
    .max(42)
    .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid Ethereum address")
    .refine(isAddress, "Must be a checksummed Ethereum address"),
});

export type GetBalanceInput = z.infer<typeof getBalanceSchema>;

export const getBalanceTool = {
  name: "getBalance" as const,
  description: "Get the ETH balance of a Sepolia wallet address",
  schema: getBalanceSchema,
  idempotent: true,
  sideEffects: false,

  async execute(input: GetBalanceInput): Promise<TokenBalance> {
    const address = input.address as Address;
    const balanceWei = await publicClient.getBalance({ address });
    return {
      token: "ETH",
      address,
      balanceWei,
      balanceEth: weiToEth(balanceWei),
    };
  },
};
