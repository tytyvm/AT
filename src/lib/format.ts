import type { ActionKind, Leg } from "@/data/actions/types";
import { shortAddress } from "./address";

/** 1234567.8 -> "1.23M"; small numbers keep enough digits to be meaningful. */
export function compactAmount(n: number): string {
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  if (abs >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return String(Number(n.toPrecision(3)));
}

const legAmount = (l: Leg) => (l.decimals === null ? Number(l.delta) : Number(l.delta) / 10 ** l.decimals);
export const legLabel = (l: Leg) => l.symbol ?? (l.asset === "native" ? "?" : shortAddress(l.asset));
const legText = (l: Leg) => `${compactAmount(Math.abs(legAmount(l)))} ${legLabel(l)}`;
const join = (legs: Leg[]) => legs.map(legText).join(" + ");

/** "Bought 2.1M BONK for 1.4 SOL". Legs arrive outflows first. */
export function describeAction(kind: ActionKind, legs: Leg[]): string {
  const out = legs.filter((l) => BigInt(l.delta) < 0n), inn = legs.filter((l) => BigInt(l.delta) > 0n);
  switch (kind) {
    case "BUY": return `Bought ${join(inn)} for ${join(out)}`;
    case "SELL": return `Sold ${join(out)} for ${join(inn)}`;
    case "SWAP": return `Swapped ${join(out)} for ${join(inn)}`;
    case "SEND": return `Sent ${join(out)}`;
    case "RECEIVE": return `Received ${join(inn)}`;
    case "LP_ADD": return `Added liquidity: ${join(out)}${inn.length ? ` (got back ${join(inn)})` : ""}`;
    case "LP_REMOVE": return `Removed liquidity: ${join(inn)}`;
  }
}

export const usd = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : `$${v >= 1000 ? compactAmount(v) : v.toFixed(2)}`;
