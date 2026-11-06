import { prisma } from "@/lib/db";
import { CHAINS, getChain, type ChainConfig } from "@/chains";

const STALL_MS = 120_000;

export interface IndexerStatus {
  chain: ChainConfig;
  ok: boolean; // false when the database can't be reached
  lagBlocks: number | null; // null = the worker hasn't completed a tick yet
  lagSeconds: number | null;
  lastBlock: string | null;
  stalled: boolean; // the worker ran before but hasn't checked in for STALL_MS
  actions: number;
  wallets: number;
}

/** Live numbers for one chain. Never throws, so a database outage doesn't take the site down. */
export async function getIndexerStatus(chainId: number): Promise<IndexerStatus> {
  const chain = getChain(chainId);
  try {
    const [cursor, actions, wallets] = await Promise.all([
      prisma.indexerCursor.findUnique({ where: { chainId } }),
      prisma.walletAction.count({ where: { chainId } }),
      prisma.watchedWallet.count({ where: { chainId } }),
    ]);
    const lagBlocks = cursor ? Number(cursor.headBlock - cursor.lastBlock) : null;
    return {
      chain, ok: true, lagBlocks,
      lagSeconds: lagBlocks === null ? null : (lagBlocks * chain.blockTimeMs) / 1000,
      lastBlock: cursor ? cursor.lastBlock.toString() : null,
      stalled: !!cursor && Date.now() - cursor.updatedAt.getTime() > STALL_MS,
      actions, wallets,
    };
  } catch {
    return { chain, ok: false, lagBlocks: null, lagSeconds: null, lastBlock: null, stalled: false, actions: 0, wallets: 0 };
  }
}

export const getAllStatuses = () => Promise.all(Object.values(CHAINS).map((c) => getIndexerStatus(c.id)));

export const isRunning = (s: IndexerStatus) => s.ok && s.lagBlocks !== null && !s.stalled;

export function describeLag(s: IndexerStatus): string {
  if (!s.ok) return "database offline";
  if (s.lagBlocks === null) return "not started";
  if (s.stalled) return "stalled";
  return `${s.lagSeconds!.toFixed(1)}s behind`;
}
