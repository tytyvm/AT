import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { CHAINS } from "@/chains";
import { makeAdapter } from "@/data/adapters";
import { ingestTxs } from "@/data/ingest";
import { saveEvents, watchedSet } from "@/data/store";
import { prisma } from "@/lib/db";

// Polling backfill/catch-up indexer. One repeatable job per chain.
// Alchemy webhooks give real-time pushes; this loop guarantees nothing is
// missed if a webhook is dropped, and backfills new wallets.

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
export const indexQueue = new Queue("index", { connection });
const POLL_MS = Number(process.env.INDEXER_POLL_MS ?? 5000);
const MAX_BLOCKS_PER_TICK = 50_000n; // ~1.4h of Robinhood Chain blocks

async function tick(chainId: number) {
  const chain = CHAINS[chainId];
  const adapter = makeAdapter(chain);
  const head = await adapter.getHead();
  const cursor = await prisma.indexerCursor.findUnique({ where: { chainId } });
  const start = cursor ? cursor.lastBlock + 1n
    : process.env.INDEXER_START_BLOCK && process.env.INDEXER_START_BLOCK !== "latest"
      ? BigInt(process.env.INDEXER_START_BLOCK) : head;
  const end = head - start > MAX_BLOCKS_PER_TICK ? start + MAX_BLOCKS_PER_TICK : head;

  if (start <= end) {
    const watched = await watchedSet(chainId);
    const hashes = await adapter.findWalletTxs([...watched], start, end);
    const events = await ingestTxs(adapter, chainId, hashes, watched);
    const saved = await saveEvents(events);
    if (saved) console.log(`[${chain.name}] ${start}-${end}: ${hashes.length} txs, ${saved} new events`);
    // Phase 2 hook: enqueue rule evaluation for the saved events here.
  }
  await prisma.indexerCursor.upsert({
    where: { chainId },
    create: { chainId, lastBlock: end, headBlock: head },
    update: { lastBlock: end, headBlock: head },
  });
}

async function main() {
  for (const id of Object.keys(CHAINS)) {
    await indexQueue.upsertJobScheduler(`index-${id}`, { every: POLL_MS }, { name: "tick", data: { chainId: Number(id) } });
  }
  new Worker("index", async (job) => tick(job.data.chainId), { connection, concurrency: 1 })
    .on("failed", (job, err) => console.error(`index job failed (chain ${job?.data.chainId}):`, err.message));
  console.log(`Indexer running for chains: ${Object.values(CHAINS).map((c) => c.name).join(", ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
