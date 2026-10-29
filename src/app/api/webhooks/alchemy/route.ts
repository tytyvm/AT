import { NextResponse } from "next/server";
import { getChain } from "@/chains";
import { makeAdapter } from "@/data/adapters";
import { ingestTxs } from "@/data/ingest";
import { saveEvents, watchedSet } from "@/data/store";
import type { Hex } from "@/data/types";
import { verifySignature } from "@/lib/alchemy-sig";

// Alchemy "Address Activity" webhook. Configure it in the Alchemy dashboard
// for Robinhood Chain mainnet, pointing at https://<your-host>/api/webhooks/alchemy.
// Phase 2 will sync watched addresses to the webhook automatically.

export async function POST(req: Request) {
  const body = await req.text();
  const key = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;
  if (!key || !verifySignature(body, req.headers.get("x-alchemy-signature"), key)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  const payload = JSON.parse(body);
  const chain = getChain(4663);
  const hashes = [...new Set<Hex>((payload?.event?.activity ?? []).map((a: { hash: Hex }) => a.hash))];
  const watched = await watchedSet(chain.id);
  const events = await ingestTxs(makeAdapter(chain), chain.id, hashes, watched);
  const saved = await saveEvents(events);
  return NextResponse.json({ ok: true, saved });
}
