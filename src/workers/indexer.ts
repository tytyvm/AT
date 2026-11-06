import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { CHAINS } from "@/chains";
import { makeIngestor } from "@/data/ingest";
import { saveActions, saveEvents, watchedSet } from "@/data/store";
import { prisma } from "@/lib/db";

// Polling backfill/catch-up indexer. One repeatable job per chain.
// Alchemy webhooks give real-time pushes on EVM; this loop guarantees nothing
// is missed if a webhook is dropped, and is the only source for Solana today.

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
const POLL_MS = Number(process.env.INDEXER_POLL_MS ?? 5000);

async function tick(chainId: number) {
  const ingestor = makeIngestor(CHAINS[chainId]);
  const { chain } = ingestor;
  const head = (await ingestor.getHead()) - ingestor.safetyLag;
  const cursor = await prisma.indexerCursor.findUnique({ where: { chainId } });
  const start = cursor ? cursor.lastBlock + 1n
    : process.env.INDEXER_START_BLOCK && process.env.INDEXER_START_BLOCK !== "latest" && chain.family === "evm"
      ? BigInt(process.env.INDEXER_START_BLOCK) : head;
  const end = head - start > ingestor.maxRangePerTick ? start + ingestor.maxRangePerTick : head;

  if (start <= end) {
    const watched = await watchedSet(chainId);
    if (watched.size) {
      const ids = await ingestor.findWalletTxs([...watched], start, end);
      const { events, actions } = await ingestor.ingest(ids, watched);
      const [savedEvents, savedActions] = await Promise.all([saveEvents(events), saveActions(actions)]);
      if (savedEvents || savedActions) console.log(`[${chain.name}] ${start}-${end}: ${ids.length} txs, ${savedActions} actions, ${savedEvents} events`);
    }
  }
  await prisma.indexerCursor.upsert({
    where: { chainId },
    create: { chainId, lastBlock: end, headBlock: head },
    update: { lastBlock: end > (cursor?.lastBlock ?? -1n) ? end : cursor!.lastBlock, headBlock: head },
  });
}

// One queue and worker per chain: a slow chain (rate limits, a backlog) never stalls another,
// and each chain still runs one tick at a time so its cursor stays consistent.
async function main() {
  for (const chain of Object.values(CHAINS)) {
    const name = `index-${chain.key}`;
    await new Queue(name, { connection }).upsertJobScheduler(name, { every: POLL_MS }, { name: "tick", data: { chainId: chain.id } });
    new Worker(name, async (job) => tick(job.data.chainId), { connection, concurrency: 1 })
      .on("failed", (job, err) => console.error(`[${chain.name}] tick failed:`, err.message));
  }
  console.log(`Indexer running for chains: ${Object.values(CHAINS).map((c) => c.name).join(", ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
