import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { robinhoodMainnet } from "../src/chains/robinhood";
import { solanaMainnet } from "../src/chains/solana";
import { classify } from "../src/data/actions/classify";
import { buildEvmActions, evmDeltas } from "../src/data/actions/evm";
import { buildSolanaActions, type SolanaParsedTx } from "../src/data/actions/solana";
import type { TxContext } from "../src/data/types";

// Fixtures are real mainnet transactions (Solana: Nov 2026; Robinhood Chain: Nov 2026), trimmed of logs text.
const sol = (name: string): SolanaParsedTx => JSON.parse(readFileSync(`tests/fixtures/solana/${name}.json`, "utf8"));
const payer = (tx: SolanaParsedTx) => tx.transaction.message.accountKeys[0].pubkey;
const SOL_PRICE = (s: string) => (s === "SOL" ? 150 : s === "ETH" ? 3000 : null);

function evm(name: string) {
  const raw = JSON.parse(readFileSync(`tests/fixtures/evm/${name}.json`, "utf8"));
  const tx: TxContext = {
    ...raw.tx, value: BigInt(raw.tx.value), fee: BigInt(raw.tx.fee), blockNumber: BigInt(raw.tx.blockNumber), timestamp: new Date(raw.tx.timestamp),
    logs: raw.tx.logs.map((l: any) => ({ ...l, blockNumber: BigInt(l.blockNumber) })),
  };
  const wallet = tx.from.toLowerCase();
  return { tx, wallet, exact: BigInt(raw.exactNative), meta: (t: string) => raw.tokens[t] ?? { symbol: null, decimals: null } };
}
const leg = (a: { legs: { asset: string; symbol: string | null; delta: string }[] }, symbol: string) => a.legs.find((l) => l.symbol === symbol);

describe("Solana actions (real transactions)", () => {
  it("pump.fun buy routed through a trading bot: venue found in inner instructions, rent excluded", () => {
    const tx = sol("pumpfun-buy-via-bot");
    const [a] = buildSolanaActions(tx, solanaMainnet, new Set([payer(tx)]), SOL_PRICE);
    expect(a.kind).toBe("BUY");
    expect(a.venue).toBe("pump.fun");
    expect(leg(a, "SOL")!.delta).toBe("-10001836"); // 0.0099 SOL to the curve + 0.0001 bot tip + 1,836 lamport fee; ATA rent and network fee excluded
    expect(a.legs.find((l) => l.asset === "4aJX6LpSjYm3wWPUDZqgqHqSxZj3r3Ltmjxy4geK55wP")!.delta).toBe("318784467605");
    expect(a.usdValue).toBe(1.5);
  });

  it("pump.fun sell", () => {
    const tx = sol("pumpfun-sell");
    const [a] = buildSolanaActions(tx, solanaMainnet, new Set([payer(tx)]), SOL_PRICE);
    expect(a.kind).toBe("SELL");
    expect(BigInt(leg(a, "SOL")!.delta)).toBeGreaterThan(0n);
  });

  it("micro-sell for a few thousand lamports is still a sell, not a send", () => {
    const tx = sol("pumpswap-micro-sell");
    const [a] = buildSolanaActions(tx, solanaMainnet, new Set([payer(tx)]), SOL_PRICE);
    expect(a.kind).toBe("SELL");
    expect(a.venue).toBe("pumpswap");
  });

  it("fee payer that only collected a USDC cut is a receive", () => {
    const tx = sol("jupiter-fee-recipient");
    const [a] = buildSolanaActions(tx, solanaMainnet, new Set([payer(tx)]), SOL_PRICE);
    expect(a.kind).toBe("RECEIVE");
    expect(a.legs).toEqual([{ asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", decimals: 6, delta: "6096" }]);
    expect(a.counterparty?.startsWith("HTvjzs")).toBe(true); // owner of the account whose USDC went down (the pool)
    expect(a.usdValue).toBe(0.01);
  });

  it("Jupiter buy is attributed to Jupiter, not the pools it routed through", () => {
    const tx = sol("jupiter-buy");
    const [a] = buildSolanaActions(tx, solanaMainnet, new Set([payer(tx)]), SOL_PRICE);
    expect(a.kind).toBe("BUY");
    expect(a.venue).toBe("jupiter");
  });

  it("ignores wallets that aren't watched and failed transactions", () => {
    const tx = sol("jupiter-buy");
    expect(buildSolanaActions(tx, solanaMainnet, new Set(["11111111111111111111111111111111"]), SOL_PRICE)).toEqual([]);
    expect(buildSolanaActions({ ...tx, meta: { ...tx.meta!, err: { InstructionError: [0, "Custom"] } } }, solanaMainnet, new Set([payer(tx)]), SOL_PRICE)).toEqual([]);
  });
});

describe("Robinhood Chain actions (real transactions)", () => {
  it("buy with ETH", () => {
    const f = evm("buy-with-eth");
    const [a] = buildEvmActions(f.tx, robinhoodMainnet, new Set([f.wallet]), f.meta, SOL_PRICE, new Map([[f.wallet, f.exact]]));
    expect(a.kind).toBe("BUY");
    expect(BigInt(leg(a, "ETH")!.delta)).toBeLessThan(0n);
    expect(a.usdValue).toBeGreaterThan(0);
  });

  it("sell paid out through an internal ETH transfer: the estimate misses it, the exact balance change doesn't", () => {
    const f = evm("sell-internal-eth");
    expect(evmDeltas(f.tx, f.wallet, robinhoodMainnet).get("native") ?? 0n).toBe(0n);
    const [a] = buildEvmActions(f.tx, robinhoodMainnet, new Set([f.wallet]), f.meta, SOL_PRICE, new Map([[f.wallet, f.exact]]));
    expect(a.kind).toBe("SELL");
    expect(leg(a, "ETH")!.delta).toBe(f.exact.toString());
  });

  it("USDG is treated as dollars", () => {
    const f = evm("usdg-trade");
    const [a] = buildEvmActions(f.tx, robinhoodMainnet, new Set([f.wallet]), f.meta, () => null, new Map([[f.wallet, f.exact]]));
    expect(["BUY", "SELL"]).toContain(a.kind);
    const usdg = leg(a, "USDG")!;
    expect(a.usdValue).toBeCloseTo(Math.abs(Number(usdg.delta)) / 1e6, 2);
  });

  it("liquidity add is labelled from the LP event", () => {
    const f = evm("lp-add");
    const [a] = buildEvmActions(f.tx, robinhoodMainnet, new Set([f.wallet]), f.meta, SOL_PRICE, new Map([[f.wallet, f.exact]]));
    expect(a.kind).toBe("LP_ADD");
    expect(a.venue).toMatch(/^uniswap-v[234]$/);
  });
});

describe("classify", () => {
  const meta = () => ({ symbol: "TKN", decimals: 18 });
  const price = () => 3000;
  const c = (d: Record<string, bigint>, opts = {}) => classify(robinhoodMainnet, new Map(Object.entries(d)), meta, price, opts);
  const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73", USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168", TKN = "0xabc";

  it("wrapping ETH into WETH nets to nothing", () => {
    expect(c({ native: -(10n ** 18n), [WETH]: 10n ** 18n })).toBeNull();
  });
  it("token for token is a swap; money for money is a swap", () => {
    expect(c({ [TKN]: -5n, "0xdef": 7n })!.kind).toBe("SWAP");
    expect(c({ native: -(10n ** 18n), [USDG]: 3_000_000_000n })!.kind).toBe("SWAP");
  });
  it("one-sided moves are sends and receives", () => {
    expect(c({ native: -(10n ** 18n) })!.kind).toBe("SEND");
    expect(c({ [TKN]: 5n })!.kind).toBe("RECEIVE");
  });
  it("drops native dust only when told to", () => {
    expect(c({ native: -100n, [TKN]: 5n }, { nativeDust: 1000n })!.kind).toBe("RECEIVE");
    expect(c({ native: -100n, [TKN]: 5n })!.kind).toBe("BUY");
  });
  it("lists what left the wallet before what arrived", () => {
    expect(c({ [TKN]: 5n, native: -(10n ** 18n) })!.legs.map((l) => l.symbol)).toEqual(["ETH", "TKN"]);
  });
});
