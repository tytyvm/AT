import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { addressUrl, getChain, txUrl } from "@/chains";
import { describeLag, getIndexerStatus } from "@/lib/status";
import { SiteFooter, SiteHeader } from "../_components/chrome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live feed" };

const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

export default async function Feed() {
  const chain = getChain(4663);
  const s = await getIndexerStatus(chain.id);
  const [events, wallets] = s.ok
    ? await Promise.all([
        prisma.chainEvent.findMany({ orderBy: { timestamp: "desc" }, take: 100 }),
        prisma.watchedWallet.findMany({ where: { chainId: chain.id }, select: { address: true, label: true } }),
      ]).catch(() => [[], []] as const)
    : ([[], []] as const);
  const labels = new Map(wallets.map((w) => [w.address, w.label]));
  const running = s.ok && s.lagBlocks !== null;

  return (
    <>
      <SiteHeader current="feed" />
      <main className="wrap">
        <div className="feed-head">
          <span className="label">Live feed · {chain.name}</span>
          <h1>What the watched wallets did, newest first.</h1>
          <p>The latest 100 decoded events across every wallet on the watchlist. Times are UTC. Click a transaction to verify it on the explorer.</p>
        </div>

        <div className="gauges">
          <div className="gauge">
            <span className="label">Indexer</span>
            <strong className={running ? undefined : "off"}>{running ? `${s.lagSeconds!.toFixed(1)}s` : describeLag(s)}</strong>
          </div>
          <div className="gauge">
            <span className="label">Last block</span>
            <strong>{s.lastBlock ? Number(s.lastBlock).toLocaleString("en-US") : "—"}</strong>
          </div>
          <div className="gauge">
            <span className="label">Wallets</span>
            <strong>{s.wallets.toLocaleString("en-US")}</strong>
          </div>
          <div className="gauge">
            <span className="label">Events</span>
            <strong>{s.events.toLocaleString("en-US")}</strong>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="empty">
            <h2>The tape is quiet.</h2>
            {!s.ok && <p>The database can’t be reached right now, so there’s nothing to show.</p>}
            {s.ok && !running && (
              <p>
                The indexer hasn’t completed its first pass yet. If this lasts more than a minute, the worker process isn’t running. See{" "}
                <Link href="/docs#faq">the FAQ</Link>.
              </p>
            )}
            {s.ok && s.wallets === 0 && <p>No wallets are on the watchlist yet. <Link href="/docs#watch-a-wallet">Here’s how to add one.</Link></p>}
            {s.ok && running && s.wallets > 0 && <p>The indexer is running. Events appear here as soon as a watched wallet moves.</p>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="events">
              <thead>
                <tr><th>Time (UTC)</th><th>Wallet</th><th>Event</th><th>Protocol</th><th>Block</th><th>Tx</th></tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{e.timestamp.toISOString().replace("T", " ").slice(0, 19)}</td>
                    <td><a href={addressUrl(chain, e.wallet)} target="_blank" rel="noreferrer">{labels.get(e.wallet) ?? short(e.wallet)}</a></td>
                    <td><span className="kind">{e.kind}</span></td>
                    <td>{e.protocol ?? "—"}</td>
                    <td>{e.blockNumber.toLocaleString("en-US")}</td>
                    <td><a href={txUrl(chain, e.txHash)} target="_blank" rel="noreferrer">{short(e.txHash)} ↗</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
