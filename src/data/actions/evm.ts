import { toEventSelector } from "viem";
import type { EvmChainConfig } from "@/chains";
import { decodeLog } from "../decode";
import type { Hex, TxContext } from "../types";
import { classify, type TokenMeta } from "./classify";
import type { PriceLookup, WalletAction } from "./types";

const WETH_DEPOSIT = toEventSelector("Deposit(address,uint256)");
const WETH_WITHDRAWAL = toEventSelector("Withdrawal(address,uint256)");
const lc = (a: string) => a.toLowerCase();
const topicAddr = (t: Hex) => lc(`0x${t.slice(26)}`);

/** Every ERC-20 token address that moved in this transaction, so callers can load symbols/decimals up front. */
export function evmTokensMoved(tx: TxContext): string[] {
  const out = new Set<string>();
  for (const l of tx.logs) {
    const ev = decodeLog(l);
    if (ev?.kind === "TRANSFER") out.add(ev.token);
  }
  return [...out];
}

/**
 * Net balance changes for one wallet. Tokens come from Transfer events.
 * ETH comes from the transaction value plus WETH unwraps: when a router
 * sells for ETH it withdraws WETH and forwards the ETH in an internal call,
 * which emits no event, so a Withdrawal in a transaction the wallet sent is
 * attributed to the wallet. That estimate misses refunds and Uniswap v4's
 * native payouts, so callers pass the exact balance change when they have it.
 */
export function evmDeltas(tx: TxContext, wallet: string, chain: EvmChainConfig, exactNative?: bigint) {
  const deltas = new Map<string, bigint>();
  const add = (asset: string, d: bigint) => deltas.set(asset, (deltas.get(asset) ?? 0n) + d);
  const weth = chain.contracts.weth ? lc(chain.contracts.weth) : null;
  const sender = lc(tx.from) === wallet;

  // With the exact balance change we skip the estimate; WETH is still tracked so wraps net out against it.
  const estimate = exactNative === undefined;
  if (!estimate) add("native", exactNative);
  if (estimate && sender) add("native", -tx.value);
  if (estimate && tx.to && lc(tx.to) === wallet) add("native", tx.value);

  let wethToWallet = false;
  for (const l of tx.logs) {
    const ev = decodeLog(l);
    if (ev?.kind === "TRANSFER") {
      if (ev.from === wallet) add(ev.token, -BigInt(ev.amount));
      if (ev.to === wallet) { add(ev.token, BigInt(ev.amount)); if (ev.token === weth) wethToWallet = true; }
    }
    if (weth && lc(l.address) === weth && l.topics.length >= 2) {
      const who = topicAddr(l.topics[1]);
      const amount = BigInt(l.data);
      // The wallet wrapping or unwrapping its own ETH: WETH9 emits no Transfer for these.
      if (l.topics[0] === WETH_DEPOSIT && who === wallet) add(weth, amount);
      if (l.topics[0] === WETH_WITHDRAWAL && who === wallet) add(weth, -amount);
      if (estimate && l.topics[0] === WETH_WITHDRAWAL && who !== wallet && sender) add("native", amount);
    }
  }
  // A router that unwrapped WETH and also sent WETH to the wallet wasn't paying out ETH.
  if (estimate && wethToWallet && sender) {
    for (const l of tx.logs) {
      if (weth && lc(l.address) === weth && l.topics[0] === WETH_WITHDRAWAL && topicAddr(l.topics[1]) !== wallet) add("native", -BigInt(l.data));
    }
  }
  return deltas;
}

/** One action per watched wallet. Swap and liquidity events set the venue; LP events override the kind for the actor. */
export function buildEvmActions(
  tx: TxContext,
  chain: EvmChainConfig,
  watched: Set<string>,
  meta: (token: string) => TokenMeta,
  price: PriceLookup,
  exactNative: Map<string, bigint> = new Map(), // wallet -> exact ETH change, when known
): WalletAction[] {
  const decoded = tx.logs.map(decodeLog);
  const involved = new Set<string>();
  if (watched.has(lc(tx.from))) involved.add(lc(tx.from));
  if (tx.to && watched.has(lc(tx.to))) involved.add(lc(tx.to));
  for (const ev of decoded) if (ev?.kind === "TRANSFER") for (const a of [ev.from, ev.to]) if (watched.has(a)) involved.add(a);

  const out: WalletAction[] = [];
  for (const wallet of involved) {
    const r = classify(chain, evmDeltas(tx, wallet, chain, exactNative.get(wallet)), meta, price);
    if (!r) continue;
    // The wallet acted if it sent the tx or is the contract that was called (bots trade through their own contracts).
    const actor = lc(tx.from) === wallet || (tx.to !== null && lc(tx.to) === wallet);
    const dex = decoded.find((e) => e && (e.kind === "SWAP" || e.kind === "LP_ADD" || e.kind === "LP_REMOVE"));
    const lp = actor ? decoded.find((e) => e?.kind === "LP_ADD" || e?.kind === "LP_REMOVE") : undefined;
    const kind = lp ? (lp.kind as "LP_ADD" | "LP_REMOVE") : r.kind;
    const isTransfer = kind === "SEND" || kind === "RECEIVE";

    let counterparty: string | null = null;
    if (isTransfer) {
      const main = r.legs[0];
      if (main.asset === "native") counterparty = kind === "SEND" ? (tx.to ? lc(tx.to) : null) : lc(tx.from);
      else {
        const t = decoded.find((e) => e?.kind === "TRANSFER" && e.token === main.asset && (kind === "SEND" ? e.from === wallet : e.to === wallet));
        if (t?.kind === "TRANSFER") counterparty = kind === "SEND" ? t.to : t.from;
      }
    }
    out.push({
      chainId: chain.id,
      txHash: tx.hash,
      wallet,
      blockNumber: tx.blockNumber,
      timestamp: tx.timestamp,
      kind,
      venue: dex && "protocol" in dex ? dex.protocol : null,
      counterparty,
      legs: r.legs,
      usdValue: r.usdValue,
    });
  }
  return out;
}
