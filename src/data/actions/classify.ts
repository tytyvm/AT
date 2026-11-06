import type { ChainConfig, QuoteAsset } from "@/chains";
import type { ActionKind, Leg, PriceLookup } from "./types";

export interface TokenMeta { symbol: string | null; decimals: number | null }

/**
 * Turns a wallet's net balance changes in one transaction into an action.
 * Wrapped native (WETH, wrapped SOL) is merged into the native asset first.
 * "Money" assets (native + stablecoins) decide the direction: spending money
 * for a token is a BUY, receiving money for a token is a SELL.
 * Returns null when nothing meaningful moved.
 */
export function classify(
  chain: ChainConfig,
  rawDeltas: Map<string, bigint>,
  meta: (asset: string) => TokenMeta,
  price: PriceLookup,
  opts: { nativeDust?: bigint } = {},
): { kind: ActionKind; legs: Leg[]; usdValue: number | null } | null {
  const quote = new Map<string, QuoteAsset>(chain.quoteAssets.map((q) => [q.address, q]));
  const deltas = new Map<string, bigint>();
  for (const [asset, d] of rawDeltas) {
    const key = quote.get(asset)?.wrapsNative ? "native" : asset;
    deltas.set(key, (deltas.get(key) ?? 0n) + d);
  }
  // Fees, rent and router refunds leave small native changes that aren't the trade.
  const dust = opts.nativeDust ?? 0n;
  const native = deltas.get("native") ?? 0n;
  if (native !== 0n && (native < 0n ? -native : native) <= dust && deltas.size > 1) deltas.delete("native");
  for (const [k, d] of deltas) if (d === 0n) deltas.delete(k);
  if (!deltas.size) return null;
  if (deltas.size === 1 && deltas.has("native") && (native < 0n ? -native : native) <= dust) return null;

  const isMoney = (a: string) => a === "native" || !!quote.get(a)?.usdPegged;
  const ins = [...deltas].filter(([, d]) => d > 0n), outs = [...deltas].filter(([, d]) => d < 0n);
  const tokenIn = ins.filter(([a]) => !isMoney(a)), tokenOut = outs.filter(([a]) => !isMoney(a));
  const moneyIn = ins.filter(([a]) => isMoney(a)), moneyOut = outs.filter(([a]) => isMoney(a));

  let kind: ActionKind;
  if (!outs.length) kind = "RECEIVE";
  else if (!ins.length) kind = "SEND";
  else if (tokenIn.length && !tokenOut.length && moneyOut.length) kind = "BUY";
  else if (tokenOut.length && !tokenIn.length && moneyIn.length) kind = "SELL";
  else kind = "SWAP";

  const legs: Leg[] = [...deltas].map(([asset, delta]) => {
    if (asset === "native") return { asset, symbol: chain.nativeSymbol, decimals: chain.nativeDecimals, delta: delta.toString() };
    const q = quote.get(asset);
    const m = q ? { symbol: q.symbol, decimals: q.decimals } : meta(asset);
    return { asset, symbol: m.symbol, decimals: m.decimals, delta: delta.toString() };
  });
  // Outflows first, then inflows, so "spent X, got Y" reads naturally.
  legs.sort((a, b) => (BigInt(a.delta) < 0n ? 0 : 1) - (BigInt(b.delta) < 0n ? 0 : 1));

  const priced = kind === "BUY" ? moneyOut : kind === "SELL" ? moneyIn : [...moneyOut, ...moneyIn];
  return { kind, legs, usdValue: usdValue(chain, priced, price) };
}

/** USD value of the money side: the largest priced leg, so a swap isn't counted twice. */
function usdValue(chain: ChainConfig, money: [string, bigint][], price: PriceLookup): number | null {
  let best: number | null = null;
  for (const [asset, d] of money) {
    const abs = Number(d < 0n ? -d : d);
    const q = asset === "native" ? { symbol: chain.nativeSymbol, decimals: chain.nativeDecimals, usdPegged: false } : chain.quoteAssets.find((x) => x.address === asset);
    if (!q) continue;
    const p = q.usdPegged ? 1 : price(q.symbol);
    if (p === null) continue;
    const usd = (abs / 10 ** q.decimals) * p;
    if (best === null || usd > best) best = usd;
  }
  return best === null ? null : Math.round(best * 100) / 100;
}
