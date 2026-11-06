import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { addressUrl, getChain, txUrl } from "@/chains";
import { getSessionUser } from "@/lib/session";
import { describeLag, getIndexerStatus } from "@/lib/status";
import { MAX_WALLETS_PER_USER } from "@/lib/watchlist";
import { Mark } from "../_components/chrome";
import { AddWalletForm } from "./add-wallet";
import { removeWallet, signOut } from "./actions";
import { ConnectWallet, SignIn } from "./sign-in";

export const metadata: Metadata = { title: "App" };

const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

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

  const chain = getChain(4663);
  const [status, wallets] = await Promise.all([
    getIndexerStatus(chain.id),
    prisma.watchedWallet.findMany({ where: { userId: user.id, chainId: chain.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const labels = new Map(wallets.map((w) => [w.address, w.label]));
  const events = wallets.length
    ? await prisma.chainEvent.findMany({ where: { chainId: chain.id, wallet: { in: [...labels.keys()] } }, orderBy: { timestamp: "desc" }, take: 100 })
    : [];
  const running = status.ok && status.lagBlocks !== null;
  const account = user.walletAddress ? short(user.walletAddress) : "Anonymous";

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
            <p className="panel-empty">Nothing here yet. Add a wallet above. Good places to find active ones: “Top accounts” on the block explorer.</p>
          ) : (
            <ul className="watchlist">
              {wallets.map((w) => (
                <li key={w.id}>
                  <div>
                    <strong>{w.label}</strong>
                    <a href={addressUrl(chain, w.address)} target="_blank" rel="noreferrer">{short(w.address)} ↗</a>
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
            <span className={`pill ${running ? "pill-live" : "pill-off"}`}>Indexer · {running ? `${status.lagSeconds!.toFixed(1)}s behind` : describeLag(status)}</span>
          </div>

          {events.length === 0 ? (
            <div className="empty">
              <h2>{wallets.length ? "Waiting for the first move." : "Add a wallet to start."}</h2>
              <p>
                {wallets.length
                  ? "The indexer records activity from the moment a wallet is added. As soon as one of yours transfers, swaps or moves liquidity, it lands here."
                  : "Once you add a wallet, every transfer, swap and liquidity move it makes on Robinhood Chain shows up here, newest first."}
              </p>
              {!running && status.ok && <p>The indexer isn’t running yet, so nothing new is being recorded. <Link href="/docs#faq">Why?</Link></p>}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="events">
                <thead><tr><th>Time (UTC)</th><th>Wallet</th><th>Event</th><th>Protocol</th><th>Tx</th></tr></thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td>{e.timestamp.toISOString().replace("T", " ").slice(0, 19)}</td>
                      <td>{labels.get(e.wallet) ?? short(e.wallet)}</td>
                      <td><span className="kind">{e.kind}</span></td>
                      <td>{e.protocol ?? "—"}</td>
                      <td><a href={txUrl(chain, e.txHash)} target="_blank" rel="noreferrer">{short(e.txHash)} ↗</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="agent-card">
            <span className="label">Agent · arriving in Phase 3</span>
            <p>
              Soon, alerts, daily digests and questions about your wallets will be handled by the model router. Each job goes to the
              cheapest open-source model that can do it well.
            </p>
            <Link href="/#router">How the router works →</Link>
          </div>
        </section>
      </main>
    </>
  );
}
