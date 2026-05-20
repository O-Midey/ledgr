import { z } from "zod";
import { isAddress } from "viem";
import type { Address } from "viem";
import type { TransferEvent } from "@/types/wallet";

export const getTransactionHistorySchema = z.object({
  address: z
    .string()
    .trim()
    .max(42)
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .refine(isAddress),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export type GetTransactionHistoryInput = z.infer<
  typeof getTransactionHistorySchema
>;

interface AlchemyTransfer {
  hash: string;
  from: string;
  to: string | null;
  value: string | null;
  blockNum: string;
  metadata?: { blockTimestamp?: string };
}

interface AlchemyResponse {
  result?: {
    transfers: AlchemyTransfer[];
  };
  error?: { message: string };
}

export const getTransactionHistoryTool = {
  name: "getTransactionHistory" as const,
  description:
    "Get the recent ETH transfer history for a Sepolia wallet address",
  schema: getTransactionHistorySchema,
  idempotent: true,
  sideEffects: false,

  async execute(input: GetTransactionHistoryInput): Promise<TransferEvent[]> {
    const alchemyUrl = process.env.ALCHEMY_RPC_URL;
    if (!alchemyUrl) throw new Error("ALCHEMY_RPC_URL is not configured");

    const address = input.address as Address;

    const body = {
      id: 1,
      jsonrpc: "2.0",
      method: "alchemy_getAssetTransfers",
      params: [
        {
          fromAddress: address,
          category: ["external"],
          withMetadata: true,
          maxCount: `0x${input.limit.toString(16)}`,
        },
      ],
    };

    const res = await fetch(alchemyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as AlchemyResponse;
    if (json.error) throw new Error(json.error.message);

    const transfers = json.result?.transfers ?? [];

    return transfers.map((t): TransferEvent => {
      const valueEth = t.value ? String(t.value) : "0";
      const valueWei = BigInt(Math.round(parseFloat(valueEth) * 1e18));
      const ts = t.metadata?.blockTimestamp
        ? new Date(t.metadata.blockTimestamp).getTime()
        : null;

      return {
        hash: t.hash as `0x${string}`,
        from: t.from as Address,
        to: (t.to ?? address) as Address,
        value: valueWei.toString() as unknown as bigint,
        valueEth,
        blockNumber: BigInt(
          parseInt(t.blockNum, 16),
        ).toString() as unknown as bigint,
        timestamp: ts,
        direction:
          t.from.toLowerCase() === address.toLowerCase()
            ? "outbound"
            : "inbound",
      };
    });
  },
};
