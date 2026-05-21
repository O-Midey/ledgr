import { z } from "zod";
import { isAddress, parseEther } from "viem";
import type { Address } from "viem";
import { publicClient } from "@/wallet/blockchainClient";
import { getAgentWalletClient, getAgentAddress } from "@/wallet/walletClient";
import { txExplorerUrl, truncateAddress, weiToEth } from "@/lib/utils";
import { SimulationError, PreconditionError } from "@/types/errors";
import type { TransactionReceipt } from "@/types/wallet";
import { MAX_SINGLE_TX_ETH } from "@/lib/constants";

export const sendTransactionSchema = z.object({
  to: z
    .string()
    .trim()
    .max(42)
    .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid Ethereum address")
    .refine(isAddress, "Invalid address"),
  valueEth: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Must be a positive numeric ETH amount")
    .refine((v) => parseFloat(v) > 0, "Amount must be positive")
    .refine(
      (v) => parseFloat(v) <= MAX_SINGLE_TX_ETH,
      `Max single tx is ${MAX_SINGLE_TX_ETH} ETH`,
    ),
  memo: z
    .string()
    .trim()
    .max(140)
    .regex(/^[\w\s.,!?'-]*$/, "Memo contains invalid characters")
    .optional(),
  idempotencyKey: z.string().trim().min(1).max(128),
  from: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .refine(isAddress, "Invalid from address")
    .optional(),
});

export type SendTransactionInput = z.infer<typeof sendTransactionSchema>;

export const sendTransactionTool = {
  name: "sendTransaction" as const,
  description: "Send ETH on Sepolia — simulated against the sender wallet before user confirmation",
  schema: sendTransactionSchema,
  idempotent: false, // handled externally by ExecutionGateway
  sideEffects: true,

  /** Simulate the transaction. Must be called before execute. */
  async simulate(input: SendTransactionInput): Promise<void> {
    const from = (input.from as Address | undefined) ?? getAgentAddress();
    const to = input.to as Address;
    const value = parseEther(input.valueEth);

    if (from.toLowerCase() === to.toLowerCase()) {
      throw new PreconditionError("Cannot send to yourself");
    }

    const balance = await publicClient.getBalance({ address: from });
    if (balance < value) {
      throw new PreconditionError("Insufficient balance", {
        balance: weiToEth(balance),
        required: input.valueEth,
      });
    }

    try {
      await publicClient.estimateGas({ account: from, to, value });
    } catch (err) {
      throw new SimulationError(
        `Transaction simulation failed: ${String(err)}`,
        {
          from,
          to,
          valueEth: input.valueEth,
        },
      );
    }
  },

  async execute(
    input: SendTransactionInput,
  ): Promise<TransactionReceipt & { message: string }> {
    const walletClient = getAgentWalletClient();
    const from = getAgentAddress();
    const to = input.to as Address;
    const value = parseEther(input.valueEth);

    const hash = await walletClient.sendTransaction({
      account: walletClient.account!,
      chain: null,
      to,
      value,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const explorerUrl = txExplorerUrl(hash);

    return {
      hash,
      from,
      to,
      value: value.toString() as unknown as bigint,
      gasUsed: receipt.gasUsed.toString() as unknown as bigint,
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString() as unknown as bigint,
      explorerUrl,
      message: `Sent ${input.valueEth} ETH to ${truncateAddress(to)}. Tx: ${hash} — ${explorerUrl}`,
    };
  },
};
