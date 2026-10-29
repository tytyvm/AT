// Generic EVM chain config. Add a chain by creating one of these and
// registering it in src/chains/index.ts. Nothing else is chain-specific.
export interface ChainConfig {
  id: number;
  name: string;
  nativeSymbol: string;
  rpcUrl: string;
  alchemyNetwork?: string; // e.g. "robinhood-mainnet"; omit if Alchemy doesn't support it
  explorer: { url: string; txPath: string; addressPath: string };
  blockTimeMs: number;
  maxLogRange: number; // max blocks per eth_getLogs call
  contracts: {
    weth?: `0x${string}`;
    multicall?: `0x${string}`;
    // Optional: the decoder matches Uniswap events by signature, but listing
    // these lets us tag "known DEX" vs "unknown contract".
    uniswapV3PositionManager?: `0x${string}`;
    uniswapV4PoolManager?: `0x${string}`;
    uniswapV4PositionManager?: `0x${string}`;
  };
  features: { stockTokens: boolean };
}

export const txUrl = (c: ChainConfig, hash: string) => `${c.explorer.url}${c.explorer.txPath}${hash}`;
export const addressUrl = (c: ChainConfig, a: string) => `${c.explorer.url}${c.explorer.addressPath}${a}`;
