import type { ChainDataAdapter } from "./adapters";
import { decodeTx } from "./decode";
import type { Hex, NormalizedEvent } from "./types";

/** Pure-ish core shared by the polling indexer and the webhook: hashes in, events out. */
export async function ingestTxs(adapter: ChainDataAdapter, chainId: number, hashes: Hex[], watched: Set<string>, concurrency = 8) {
  const out: NormalizedEvent[] = [];
  for (let i = 0; i < hashes.length; i += concurrency) {
    const batch = await Promise.all(hashes.slice(i, i + concurrency).map((h) => adapter.getTx(h)));
    for (const tx of batch) out.push(...decodeTx(tx, chainId, watched));
  }
  return out;
}
