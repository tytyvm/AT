import type { SolanaChainConfig } from "./types";

// Solana has no EVM chain ID; 101 is the mainnet-beta id used by the Solana
// token list, so it's stable and recognisable in the database.
export const solanaMainnet: SolanaChainConfig = {
  family: "solana",
  id: 101,
  key: "solana",
  name: "Solana",
  nativeSymbol: "SOL",
  nativeDecimals: 9,
  rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  alchemyNetwork: "solana-mainnet",
  explorer: { url: "https://solscan.io", txPath: "/tx/", addressPath: "/account/" },
  blockTimeMs: 400,
  quoteAssets: [
    { address: "native", symbol: "SOL", decimals: 9 },
    { address: "So11111111111111111111111111111111111111112", symbol: "SOL", decimals: 9, wrapsNative: true },
    { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", decimals: 6, usdPegged: true },
    { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", symbol: "USDT", decimals: 6, usdPegged: true },
  ],
  programs: {
    JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: "jupiter",
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "raydium",
    CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C: "raydium",
    CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: "raydium",
    whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: "orca",
    LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo: "meteora",
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "pump.fun",
    pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: "pumpswap",
  },
};
