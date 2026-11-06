import { prisma } from "@/lib/db";
import type { WalletAction } from "./actions/types";
import type { NormalizedEvent } from "./types";

/** Idempotent insert: replaying a block range or a duplicate webhook is safe. */
export async function saveEvents(events: NormalizedEvent[]) {
  if (!events.length) return 0;
  const res = await prisma.chainEvent.createMany({
    skipDuplicates: true,
    data: events.map((e) => {
      const { kind, ...rest } = e.event;
      return {
        chainId: e.chainId, txHash: e.txHash, logIndex: e.logIndex,
        blockNumber: e.blockNumber, timestamp: e.timestamp, kind,
        wallet: e.wallet, contract: e.contract,
        protocol: "protocol" in rest ? (rest.protocol as string) : null,
        data: rest as object,
      };
    }),
  });
  return res.count;
}

/** Idempotent like saveEvents: one action per (chain, tx, wallet). */
export async function saveActions(actions: WalletAction[]) {
  if (!actions.length) return 0;
  const res = await prisma.walletAction.createMany({
    skipDuplicates: true,
    data: actions.map((a) => ({
      chainId: a.chainId, txHash: a.txHash, wallet: a.wallet, blockNumber: a.blockNumber, timestamp: a.timestamp,
      kind: a.kind, venue: a.venue, counterparty: a.counterparty, legs: a.legs as object[], usdValue: a.usdValue,
    })),
  });
  return res.count;
}

/** Watched addresses exactly as stored: lowercase on EVM, case-sensitive on Solana. */
export async function watchedSet(chainId: number): Promise<Set<string>> {
  const rows = await prisma.watchedWallet.findMany({ where: { chainId }, select: { address: true }, distinct: ["address"] });
  return new Set(rows.map((r) => r.address));
}
