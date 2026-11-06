// A wallet action is one human-readable thing a wallet did in one transaction:
// "bought 2.1M BONK for 1.4 SOL". It's built from the wallet's net balance
// changes, so it works the same for any DEX, router or launchpad.

export type ActionKind = "BUY" | "SELL" | "SWAP" | "SEND" | "RECEIVE" | "LP_ADD" | "LP_REMOVE";

export interface Leg {
  asset: string; // token address/mint, or "native"
  symbol: string | null;
  decimals: number | null;
  delta: string; // signed, in base units: negative = left the wallet
}

export interface WalletAction {
  chainId: number;
  txHash: string;
  wallet: string;
  blockNumber: bigint; // block on EVM, slot on Solana
  timestamp: Date;
  kind: ActionKind;
  venue: string | null; // "uniswap-v3", "jupiter", "pump.fun"…
  counterparty: string | null; // for sends/receives: the other side
  legs: Leg[];
  usdValue: number | null; // value of the "money" side, when priced
}

/** Spot USD price for a quote asset's symbol (ETH, SOL…). Injected so builders stay pure and testable. */
export type PriceLookup = (symbol: string) => number | null;
