import type { ChainConfig, EvmChainConfig, SolanaChainConfig } from "@/chains";
import { cachedUsdPrice, fetchUsdPrices } from "@/prices/spot";
import { buildEvmActions, evmTokensMoved } from "./actions/evm";
import { buildSolanaActions } from "./actions/solana";
import type { WalletAction } from "./actions/types";
import { makeAdapter } from "./adapters";
import { SolanaAdapter } from "./adapters/solana";
import { decodeTx } from "./decode";
import { tokenMetas } from "./tokens";
import type { Hex, NormalizedEvent, TxContext } from "./types";

/** One per chain. The indexer and the webhook only talk to this. */
export interface ChainIngestor {
  chain: ChainConfig;
  /** How far behind the head to stay so late-indexed transactions aren't skipped. */
  safetyLag: bigint;
  maxRangePerTick: bigint;
  getHead(): Promise<bigint>;
  findWalletTxs(wallets: string[], from: bigint, to: bigint): Promise<string[]>;
  ingest(ids: string[], watched: Set<string>): Promise<{ events: NormalizedEvent[]; actions: WalletAction[] }>;
}

async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

function evmIngestor(chain: EvmChainConfig): ChainIngestor {
  const adapter = makeAdapter(chain);
  return {
    chain,
    safetyLag: 0n,
    maxRangePerTick: 50_000n, // ~1.4h of 100ms blocks
    getHead: () => adapter.getHead(),
    findWalletTxs: (wallets, from, to) => adapter.findWalletTxs(wallets, from, to),
    async ingest(ids, watched) {
      const txs = await inBatches(ids as Hex[], 8, (h) => adapter.getTx(h));
      const [metas] = await Promise.all([tokenMetas(chain, [...new Set(txs.flatMap(evmTokensMoved))]), fetchUsdPrices([chain.nativeSymbol])]);
      const meta = (t: string) => metas.get(t) ?? { symbol: null, decimals: null };

      // Exact ETH change per wallet catches internal transfers. Only valid when the wallet has one tx in that block.
      const perBlock = new Map<string, number>();
      const involved = (tx: TxContext) => [...new Set([tx.from, tx.to ?? "", ...tx.logs.flatMap((l) => l.topics.slice(1, 3).map((t) => `0x${t.slice(26)}`))].map((a) => a.toLowerCase()))].filter((a) => watched.has(a));
      for (const tx of txs) for (const w of involved(tx)) perBlock.set(`${w}@${tx.blockNumber}`, (perBlock.get(`${w}@${tx.blockNumber}`) ?? 0) + 1);

      const events: NormalizedEvent[] = [], actions: WalletAction[] = [];
      for (const tx of txs) {
        events.push(...decodeTx(tx, chain.id, watched));
        const exact = new Map<string, bigint>();
        await Promise.all(involved(tx).filter((w) => perBlock.get(`${w}@${tx.blockNumber}`) === 1).map(async (w) => {
          const d = await adapter.nativeChange(w, tx.blockNumber, w === tx.from.toLowerCase() ? tx.fee ?? 0n : 0n);
          if (d !== null) exact.set(w, d);
        }));
        actions.push(...buildEvmActions(tx, chain, watched, meta, cachedUsdPrice, exact));
      }
      return { events, actions };
    },
  };
}

function solanaIngestor(chain: SolanaChainConfig): ChainIngestor {
  const adapter = new SolanaAdapter(chain);
  return {
    chain,
    safetyLag: 40n, // ~16s: signatures can be indexed a few slots after the slot itself
    maxRangePerTick: 10_000n,
    getHead: () => adapter.getHead(),
    findWalletTxs: (wallets, from, to) => adapter.findWalletTxs(wallets, from, to),
    async ingest(ids, watched) {
      const [txs] = await Promise.all([inBatches(ids, 4, (s) => adapter.getTx(s)), fetchUsdPrices([chain.nativeSymbol])]);
      const actions = txs.flatMap((tx) => (tx ? buildSolanaActions(tx, chain, watched, cachedUsdPrice) : []));
      return { events: [], actions };
    },
  };
}

const cache = new Map<number, ChainIngestor>();
export function makeIngestor(chain: ChainConfig): ChainIngestor {
  if (!cache.has(chain.id)) cache.set(chain.id, chain.family === "evm" ? evmIngestor(chain) : solanaIngestor(chain));
  return cache.get(chain.id)!;
}
