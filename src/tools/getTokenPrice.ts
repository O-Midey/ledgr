import { z } from "zod";

export const getTokenPriceSchema = z.object({
  token: z.enum(["ETH"]),
  currency: z.enum(["USD", "EUR", "GBP"]).optional().default("USD"),
});

export type GetTokenPriceInput = z.infer<typeof getTokenPriceSchema>;

interface CoinGeckoResponse {
  ethereum?: { usd?: number; eur?: number; gbp?: number };
}

export const getTokenPriceTool = {
  name: "getTokenPrice" as const,
  description:
    "Fetch the current ETH price in a fiat currency (USD by default)",
  schema: getTokenPriceSchema,
  idempotent: true,
  sideEffects: false,

  async execute(
    input: GetTokenPriceInput,
  ): Promise<{ token: string; currency: string; price: number }> {
    const currencyKey = input.currency.toLowerCase() as "usd" | "eur" | "gbp";

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=${currencyKey}`;
    const res = await fetch(url, { next: { revalidate: 60 } });

    if (!res.ok) {
      throw new Error(`CoinGecko request failed: ${res.status}`);
    }

    const json = (await res.json()) as CoinGeckoResponse;
    const price = json.ethereum?.[currencyKey];

    if (price === undefined) {
      throw new Error("Price not available in response");
    }

    return { token: input.token, currency: input.currency, price };
  },
};
