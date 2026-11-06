import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { addressUrl, getChain } from "@/chains";
import { shortAddress } from "@/lib/address";
import { getSessionUser } from "@/lib/session";
import { describeLag, getAllStatuses, isRunning } from "@/lib/status";
import { MAX_WALLETS_PER_USER } from "@/lib/watchlist";
import { ActionList, ChainBadge } from "../_components/actions";
import { Mark } from "../_components/chrome";
import { AddWalletForm } from "./add-wallet";
import { removeWallet, signOut } from "./actions";
import { ConnectWallet, SignIn } from "./sign-in";

export const metadata: Metadata = { title: "App" };

function AppBar({ account }: { account?: string }) {
  return (
    <header className="masthead">
      <div className="wrap masthead-inner">
        <Link href="/" className="wordmark"><Mark /><span className="wm-text">Agentic Wallet Tracker</span></Link>
        <span className="app-chip">App</span>
        {account && (
          <form action={signOut} className="account">
            <span className="account-id">{account}</span>
            <button type="submit" className="link-btn">Sign out</button>
          </form>
        )}
      </div>
    </header>
  );
}

export default async function AppPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) {
    return (
      <>
        <AppBar />
        <main className="wrap"><SignIn /></main>
      </>
    );
  }

  const [statuses, wallets] = await Promise.all([
    getAllStatuses(),
    prisma.watchedWallet.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const labels = new Map(wallets.map((w) => [`${w.chainId}:${w.address}`, w.label]));
  const actions = wallets.length
    ? await prisma.walletAction.findMany({
        where: { OR: wallets.map((w) => ({ chainId: w.chainId, wallet: w.address })) },
        orderBy: { timestamp: "desc" },
        take: 100,
      })
    : [];
  // Only chains the user actually watches matter for the "is it running" message.
  const watchedChains = new Set(wallets.map((w) => w.chainId));
  const relevant = statuses.filter((s) => watchedChains.has(s.chain.id));
  const notRunning = relevant.filter((s) => s.ok && !isRunning(s));
  const account = user.walletAddress ? shortAddress(user.walletAddress) : "Anonymous";

  return (
    <>
      <AppBar account={account} />
      <main className="wrap app">
        <aside className="panel">
          <div className="panel-head">
            <h2>Watchlist</h2>
            <span className="label">{wallets.length} / {MAX_WALLETS_PER_USER}</span>
          </div>
          <AddWalletForm disabled={wallets.length >= MAX_WALLETS_PER_USER} />
          {wallets.length === 0 ? (
            <p className="panel-empty">Nothing here yet. Paste a Robinhood Chain or Solana address above; the chain is detected for you.</p>
          ) : (
            <ul className="watchlist">
              {wallets.map((w) => (
                <li key={w.id}>
                  <div>
                    <strong><ChainBadge chainId={w.chainId} /> {w.label}</strong>
                    <a href={addressUrl(getChain(w.chainId), w.address)} target="_blank" rel="noreferrer">{shortAddress(w.address)} ↗</a>
                  </div>
                  <form action={removeWallet}>
                    <input type="hidden" name="id" value={w.id} />
                    <button type="submit" className="link-btn" aria-label={`Stop watching ${w.label}`}>Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {!user.walletAddress && (
            <div className="panel-note">
              <p>Anonymous workspace: it lives in this browser’s cookies, and signing out deletes it. Connect a wallet to keep this list on any device.</p>
              <ConnectWallet label="Connect wallet & keep list" solid={false} />
            </div>
          )}
        </aside>

        <section className="activity">
          <div className="activity-head">
            <h1>Activity</h1>
            <div className="pills">
              {statuses.map((s) => (
                <span key={s.chain.id} className={`pill ${isRunning(s) ? "pill-live" : "pill-off"}`}>{s.chain.name} · {describeLag(s)}</span>
              ))}
            </div>
          </div>

          {actions.length === 0 ? (
            <div className="empty">
              <h2>{wallets.length ? "Waiting for the first move." : "Add a wallet to start."}</h2>
              <p>
                {wallets.length
                  ? "Activity is recorded from the moment a wallet is added. As soon as one of yours buys, sells, swaps or moves funds, it lands here."
                  : "Once you add a wallet, every buy, sell, swap and transfer it makes on Robinhood Chain or Solana shows up here, newest first."}
              </p>
              {notRunning.length > 0 && (
                <p>The indexer for {notRunning.map((s) => s.chain.name).join(" and ")} isn’t running, so nothing new is being recorded there. <Link href="/docs#faq">Why?</Link></p>
              )}
            </div>
          ) : (
            <ActionList actions={actions} labels={labels} />
          )}

          <div className="agent-card">
            <span className="label">Agent · coming next</span>
            <p>
              Soon each meaningful move gets an explanation: who the counterparty is, where the money came from, and whether it lines up
              with the deployer or other wallets. Written by the cheapest open-source model that can do the job well.
            </p>
            <Link href="/#router">How the router works →</Link>
          </div>
        </section>
      </main>
    </>
  );
}
