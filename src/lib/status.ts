import { prisma } from "@/lib/db";
import { getChain } from "@/chains";

export interface IndexerStatus {
  ok: boolean; // false when the database can't be reached
  lagBlocks: number | null; // null = the worker hasn't completed a tick yet
  lagSeconds: number | null;
  lastBlock: string | null;
  events: number;
  wallets: number;
}

/** Live numbers for the public pages. Never throws, so a database outage doesn't take the site down. */
export async function getIndexerStatus(chainId = 4663): Promise<IndexerStatus> {
  const chain = getChain(chainId);
  try {
    const [cursor, events, wallets] = await Promise.all([
      prisma.indexerCursor.findUnique({ where: { chainId } }),
      prisma.chainEvent.count({ where: { chainId } }),
      prisma.watchedWallet.count({ where: { chainId } }),
    ]);
    const lagBlocks = cursor ? Number(cursor.headBlock - cursor.lastBlock) : null;
    return {
      ok: true,
      lagBlocks,
      lagSeconds: lagBlocks === null ? null : (lagBlocks * chain.blockTimeMs) / 1000,
      lastBlock: cursor ? cursor.lastBlock.toString() : null,
      events,
      wallets,
    };
  } catch {
    return { ok: false, lagBlocks: null, lagSeconds: null, lastBlock: null, events: 0, wallets: 0 };
  }
}

export function describeLag(s: IndexerStatus): string {
  if (!s.ok) return "database offline";
  if (s.lagBlocks === null) return "not started";
  return `${s.lagBlocks.toLocaleString("en-US")} blocks behind (~${s.lagSeconds!.toFixed(1)}s)`;
}
