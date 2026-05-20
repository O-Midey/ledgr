import { z } from "zod";
import { isAddress, parseEther } from "viem";
import { publicClient } from "@/wallet/blockchainClient";
import { weiToEth } from "@/lib/utils";
import type { GasEstimate } from "@/types/wallet";
import type { Address } from "viem";

export const estimateGasSchema = z.object({
  from: z
    .string()
    .trim()
    .max(42)
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .refine(isAddress),
  to: z
    .string()
    .trim()
    .max(42)
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .refine(isAddress),
  valueEth: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Must be a numeric ETH amount")
    .refine((v) => parseFloat(v) > 0, "Amount must be positive")
    .refine((v) => parseFloat(v) <= 100, "Amount too large for estimation"),
});

export type EstimateGasInput = z.infer<typeof estimateGasSchema>;

export const estimateGasTool = {
  name: "estimateGas" as const,
  description: "Estimate the gas cost for an ETH transfer on Sepolia",
  schema: estimateGasSchema,
  idempotent: true,
  sideEffects: false,

  async execute(input: EstimateGasInput): Promise<GasEstimate> {
    const from = input.from as Address;
    const to = input.to as Address;
    const value = parseEther(input.valueEth);

    const [gasUnits, gasPrice] = await Promise.all([
      publicClient.estimateGas({ account: from, to, value }),
      publicClient.getGasPrice(),
    ]);

    const totalCostWei = gasUnits * gasPrice;

    return {
      gasUnits: gasUnits.toString() as unknown as bigint,
      gasPriceWei: gasPrice.toString() as unknown as bigint,
      totalCostWei: totalCostWei.toString() as unknown as bigint,
      totalCostEth: weiToEth(totalCostWei),
    };
  },
};
