import type { ChainConfig } from "./types";
import { robinhoodMainnet } from "./robinhood";

export const CHAINS: Record<number, ChainConfig> = {
  [robinhoodMainnet.id]: robinhoodMainnet,
};

export function getChain(id: number): ChainConfig {
  const c = CHAINS[id];
  if (!c) throw new Error(`Unknown chain ${id}. Register it in src/chains/index.ts`);
  return c;
}
export * from "./types";
