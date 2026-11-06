import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SHOWCASE_EMAIL } from "@/lib/showcase";
import { describeLag, getAllStatuses, isRunning } from "@/lib/status";
import { ActionList } from "../_components/actions";
import { SiteFooter, SiteHeader } from "../_components/chrome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live feed" };

// Public, read-only. Shows only the operator's showcase wallets: users' own watchlists stay private.
export default async function Feed() {
  const statuses = await getAllStatuses();
  const dbOk = statuses.every((s) => s.ok);
  const showcase = dbOk
    ? await prisma.watchedWallet.findMany({ where: { user: { email: SHOWCASE_EMAIL } }, select: { chainId: true, address: true, label: true } }).catch(() => [])
    : [];
  const actions = showcase.length
    ? await prisma.walletAction.findMany({
        where: { OR: showcase.map((w) => ({ chainId: w.chainId, wallet: w.address })) },
        orderBy: { timestamp: "desc" },
        take: 100,
      }).catch(() => [])
    : [];
  const labels = new Map(showcase.map((w) => [`${w.chainId}:${w.address}`, w.label]));
  const totalActions = statuses.reduce((n, s) => n + s.actions, 0);
  const totalWallets = statuses.reduce((n, s) => n + s.wallets, 0);

  return (
    <>
      <SiteHeader current="feed" />
      <main className="wrap">
        <div className="feed-head">
          <span className="label">Live feed · Robinhood Chain + Solana</span>
          <h1>What the showcase wallets did, newest first.</h1>
          <p>
            A public sample of what the tracker records: buys, sells, swaps and transfers for a few showcase wallets. Your own
            watchlist is private. <Link href="/app">Launch the app</Link> to build one.
          </p>
        </div>

        <div className="gauges">
          {statuses.map((s) => (
            <div className="gauge" key={s.chain.id}>
              <span className="label">{s.chain.name} indexer</span>
              <strong className={isRunning(s) ? undefined : "off"}>{isRunning(s) ? `${s.lagSeconds!.toFixed(1)}s` : describeLag(s)}</strong>
            </div>
          ))}
          <div className="gauge">
            <span className="label">Wallets watched</span>
            <strong>{totalWallets.toLocaleString("en-US")}</strong>
          </div>
          <div className="gauge">
            <span className="label">Actions recorded</span>
            <strong>{totalActions.toLocaleString("en-US")}</strong>
          </div>
        </div>

        {actions.length === 0 ? (
          <div className="empty">
            <h2>The tape is quiet.</h2>
            {!dbOk && <p>The database can’t be reached right now, so there’s nothing to show.</p>}
            {dbOk && !showcase.length && <p>No showcase wallets are set up yet. <Link href="/docs#watch-a-wallet">Operators can seed some.</Link></p>}
            {dbOk && showcase.length > 0 && <p>The showcase wallets haven’t moved since they were added. Actions appear here as soon as they do.</p>}
            {dbOk && statuses.some((s) => !isRunning(s)) && (
              <p>An indexer isn’t running, so nothing new is being recorded there. <Link href="/docs#faq">See the FAQ</Link>.</p>
            )}
          </div>
        ) : (
          <ActionList actions={actions} labels={labels} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
