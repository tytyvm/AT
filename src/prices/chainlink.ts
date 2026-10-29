import { createPublicClient, http, parseAbi, type Hex } from "viem";
import type { ChainConfig } from "@/chains";
import { isStockPriceStale } from "./market-hours";

const FEED_ABI = parseAbi([
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "function decimals() view returns (uint8)",
]);

export interface PriceQuote { usd: number; updatedAt: Date; stale: boolean }

/** Reads a Chainlink feed. Stock-token prices already include the corporate-action multiplier. */
export async function readFeed(chain: ChainConfig, feed: Hex, isStock: boolean): Promise<PriceQuote | null> {
  const client = createPublicClient({ transport: http(chain.rpcUrl) });
  const [[, answer, , updatedAt], decimals] = await Promise.all([
    client.readContract({ address: feed, abi: FEED_ABI, functionName: "latestRoundData" }),
    client.readContract({ address: feed, abi: FEED_ABI, functionName: "decimals" }),
  ]);
  if (answer <= 0n || updatedAt === 0n) return null;
  const at = new Date(Number(updatedAt) * 1000);
  return { usd: Number(answer) / 10 ** decimals, updatedAt: at, stale: isStock ? isStockPriceStale(at) : false };
}
