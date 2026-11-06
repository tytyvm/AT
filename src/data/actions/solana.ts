import type { SolanaChainConfig } from "@/chains";
import { classify } from "./classify";
import type { Leg, PriceLookup, WalletAction } from "./types";

// The subset of getTransaction(encoding: "jsonParsed") we read.
interface ParsedIx { programId: string; parsed?: { type?: string; info?: Record<string, unknown> } }
interface TokenBalance { accountIndex: number; mint: string; owner?: string; uiTokenAmount: { amount: string; decimals: number } }
export interface SolanaParsedTx {
  slot: number;
  blockTime: number | null;
  transaction: { signatures: string[]; message: { accountKeys: { pubkey: string }[]; instructions: ParsedIx[] } };
  meta: {
    err: unknown;
    fee: number;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
    innerInstructions?: { index: number; instructions: ParsedIx[] }[];
  } | null;
}

const WSOL = "So11111111111111111111111111111111111111112";
// 0.003 SOL: on a plain transfer, tips and stray rent aren't the point. Inside a trade every lamport counts:
// micro-sells for a few thousand lamports are real (and common with bots).
const TRANSFER_DUST = 3_000_000n;

const allIxs = (tx: SolanaParsedTx) => [
  ...tx.transaction.message.instructions,
  ...(tx.meta?.innerInstructions ?? []).flatMap((x) => x.instructions),
];

/** Token accounts (by account index) with their mint and owner, before or after the transaction. */
function tokenAccounts(tx: SolanaParsedTx) {
  const m = new Map<number, { mint: string; owner?: string; pre: bigint; post: bigint; decimals: number }>();
  for (const b of tx.meta?.preTokenBalances ?? []) m.set(b.accountIndex, { mint: b.mint, owner: b.owner, pre: BigInt(b.uiTokenAmount.amount), post: 0n, decimals: b.uiTokenAmount.decimals });
  for (const b of tx.meta?.postTokenBalances ?? []) {
    const e = m.get(b.accountIndex);
    if (e) { e.post = BigInt(b.uiTokenAmount.amount); e.owner ??= b.owner; }
    else m.set(b.accountIndex, { mint: b.mint, owner: b.owner, pre: 0n, post: BigInt(b.uiTokenAmount.amount), decimals: b.uiTokenAmount.decimals });
  }
  return m;
}

/** Net balance changes for one wallet: SOL in lamports (fee and token-account rent excluded), tokens by mint. */
export function solanaDeltas(tx: SolanaParsedTx, wallet: string) {
  const meta = tx.meta!;
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey);
  const deltas = new Map<string, bigint>();
  const decimals = new Map<string, number>();
  const accounts = tokenAccounts(tx);

  const i = keys.indexOf(wallet);
  if (i >= 0) {
    let sol = BigInt(meta.postBalances[i]) - BigInt(meta.preBalances[i]);
    if (i === 0) sol += BigInt(meta.fee); // the fee payer is always account 0
    const owned = new Set([...accounts].filter(([, a]) => a.owner === wallet).map(([idx]) => keys[idx]));
    for (const ix of allIxs(tx)) {
      const info = ix.parsed?.info ?? {};
      // Rent paid to open the wallet's own token accounts isn't money spent on the trade…
      if (ix.parsed?.type === "createAccount" && info.source === wallet && owned.has(String(info.newAccount))) sol += BigInt(Number(info.lamports ?? 0));
      // …and rent refunded when one closes isn't proceeds. Wrapped-SOL accounts are the exception: their lamports are the trade.
      if (ix.parsed?.type === "closeAccount" && info.destination === wallet) {
        const idx = keys.indexOf(String(info.account));
        const acct = accounts.get(idx);
        if (idx >= 0 && acct?.owner === wallet && acct.mint !== WSOL) sol -= BigInt(meta.preBalances[idx]);
      }
    }
    if (sol !== 0n) deltas.set("native", sol);
  }
  for (const a of accounts.values()) {
    if (a.owner !== wallet || a.post === a.pre) continue;
    // Wrapped SOL here is merged into native by classify(); temporary wSOL accounts never show up, their lamports do.
    deltas.set(a.mint, (deltas.get(a.mint) ?? 0n) + a.post - a.pre);
    decimals.set(a.mint, a.decimals);
  }
  return { deltas, decimals };
}

/** Where the trade happened: an aggregator if one was used, otherwise the first known venue. */
export function solanaVenue(tx: SolanaParsedTx, chain: SolanaChainConfig): string | null {
  const found = allIxs(tx).map((ix) => chain.programs[ix.programId]).filter(Boolean);
  return found.includes("jupiter") ? "jupiter" : found[0] ?? null;
}

/** For a send or receive, the address on the other side. */
function counterparty(tx: SolanaParsedTx, wallet: string, legs: Leg[]): string | null {
  const main = legs[0];
  if (!main) return null;
  const sign = BigInt(main.delta) < 0n ? 1n : -1n; // the other side moved the opposite way
  if (main.asset === "native") {
    const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey);
    let best: string | null = null, bestAbs = 0n;
    keys.forEach((k, i) => {
      if (k === wallet) return;
      const d = (BigInt(tx.meta!.postBalances[i]) - BigInt(tx.meta!.preBalances[i])) * sign;
      if (d > bestAbs) { best = k; bestAbs = d; }
    });
    return best;
  }
  for (const a of tokenAccounts(tx).values()) {
    if (a.mint === main.asset && a.owner && a.owner !== wallet && (a.post - a.pre) * sign > 0n) return a.owner;
  }
  return null;
}

/** One action per watched wallet touched by the transaction. Failed transactions produce nothing. */
export function buildSolanaActions(tx: SolanaParsedTx, chain: SolanaChainConfig, watched: Set<string>, price: PriceLookup): WalletAction[] {
  if (!tx.meta || tx.meta.err) return [];
  const involved = new Set<string>();
  for (const k of tx.transaction.message.accountKeys) if (watched.has(k.pubkey)) involved.add(k.pubkey);
  for (const a of tokenAccounts(tx).values()) if (a.owner && watched.has(a.owner)) involved.add(a.owner);

  const venue = solanaVenue(tx, chain);
  const out: WalletAction[] = [];
  for (const wallet of involved) {
    const { deltas, decimals } = solanaDeltas(tx, wallet);
    const r = classify(chain, deltas, (mint) => ({ symbol: null, decimals: decimals.get(mint) ?? null }), price, { nativeDust: venue ? 0n : TRANSFER_DUST });
    if (!r) continue;
    const isTransfer = r.kind === "SEND" || r.kind === "RECEIVE";
    out.push({
      chainId: chain.id,
      txHash: tx.transaction.signatures[0],
      wallet,
      blockNumber: BigInt(tx.slot),
      timestamp: new Date((tx.blockTime ?? 0) * 1000),
      kind: r.kind,
      venue: isTransfer ? null : venue,
      counterparty: isTransfer ? counterparty(tx, wallet, r.legs) : null,
      legs: r.legs,
      usdValue: r.usdValue,
    });
  }
  return out;
}
