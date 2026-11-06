import type { EvmChainConfig } from "./types";

// Verified against docs.robinhood.com/chain/connecting and /protocol-contracts (Oct 2026).
export const robinhoodMainnet: EvmChainConfig = {
  family: "evm",
  id: 4663,
  key: "robinhood",
  name: "Robinhood Chain",
  nativeSymbol: "ETH",
  nativeDecimals: 18,
  rpcUrl: process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
  alchemyNetwork: "robinhood-mainnet",
  explorer: { url: "https://robinhoodchain.blockscout.com", txPath: "/tx/", addressPath: "/address/" },
  blockTimeMs: 100, // ~100ms blocks: never scan every block, filter by wallet instead
  maxLogRange: 10_000,
  contracts: {
    weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
    multicall: "0x2cAC2D899eCC914d704FeaAE33ac1bF36277DaD1",
    // TODO: fill from Uniswap's official deployments list for chain 4663
    uniswapV3PositionManager: undefined,
    uniswapV4PoolManager: undefined,
    uniswapV4PositionManager: undefined,
  },
  features: { stockTokens: true },
  // USDG (Global Dollar) is the chain's main dollar pair; verified on-chain: name "Global Dollar", 6 decimals.
  quoteAssets: [
    { address: "native", symbol: "ETH", decimals: 18 },
    { address: "0x0bd7d308f8e1639fab988df18a8011f41eacad73", symbol: "WETH", decimals: 18, wrapsNative: true },
    { address: "0x5fc5360d0400a0fd4f2af552add042d716f1d168", symbol: "USDG", decimals: 6, usdPegged: true },
  ],
};
