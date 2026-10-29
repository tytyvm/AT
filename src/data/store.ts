import { prisma } from "@/lib/db";
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

export async function watchedSet(chainId: number): Promise<Set<string>> {
  const rows = await prisma.watchedWallet.findMany({ where: { chainId }, select: { address: true }, distinct: ["address"] });
  return new Set(rows.map((r) => r.address.toLowerCase()));
}
