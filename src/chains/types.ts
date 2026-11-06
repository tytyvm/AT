// Chain configs. Add a chain by creating one of these and registering it in
// src/chains/index.ts. EVM chains share one ingestion path; other families
// (Solana) bring their own adapter and action builder.

/** An asset the action builder treats as "money" when deciding buy vs sell. */
export interface QuoteAsset {
  address: string; // token address/mint, or "native"
  symbol: string;
  decimals: number;
  usdPegged?: boolean; // stablecoins: 1 unit = $1
  wrapsNative?: boolean; // WETH, wrapped SOL: counted as the native asset
}

interface ChainBase {
  /** Numeric id stored in the database. EVM chain ID; for non-EVM chains an established registry number. */
  id: number;
  key: string; // short stable name, e.g. "robinhood", "solana"
  name: string;
  nativeSymbol: string;
  nativeDecimals: number;
  rpcUrl: string;
  alchemyNetwork?: string; // e.g. "robinhood-mainnet"; omit if Alchemy doesn't support it
  explorer: { url: string; txPath: string; addressPath: string };
  blockTimeMs: number;
  quoteAssets: QuoteAsset[];
}

export interface EvmChainConfig extends ChainBase {
  family: "evm";
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

export interface SolanaChainConfig extends ChainBase {
  family: "solana";
  /** Program id -> venue name, used to tag where a trade happened. */
  programs: Record<string, string>;
}

export type ChainConfig = EvmChainConfig | SolanaChainConfig;

export const txUrl = (c: ChainConfig, hash: string) => `${c.explorer.url}${c.explorer.txPath}${hash}`;
export const addressUrl = (c: ChainConfig, a: string) => `${c.explorer.url}${c.explorer.addressPath}${a}`;
