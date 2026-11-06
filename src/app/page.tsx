import Link from "next/link";
import { SiteFooter, SiteHeader, Tape } from "./_components/chrome";
import { describeLag, getIndexerStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "i.",
    title: "Find",
    body: "Ask the data provider only for transactions that touch a watched wallet, using Alchemy's Transfers API or filtered eth_getLogs.",
    margin: "Skips the ~99.99% of blocks your wallets never touch.",
  },
  {
    n: "ii.",
    title: "Fetch",
    body: "Pull receipts for just those transactions, with every log they emitted and the block timestamp.",
    margin: "One receipt per relevant tx. No full-block downloads.",
  },
  {
    n: "iii.",
    title: "Decode",
    body: "Match each log by its event signature: ERC-20 and stock-token transfers, Uniswap v2/v3/v4 swaps, liquidity changes, LP position NFTs.",
    margin: "Signature matching means any Uniswap-compatible fork decodes with zero config.",
  },
  {
    n: "iv.",
    title: "Store",
    body: "Write one normalized event per wallet, per log. Inserts are idempotent, so replays and duplicate webhooks change nothing.",
    margin: "Unique on (chain, tx, log index, wallet).",
  },
];

const VOCAB = [
  ["TRANSFER", "Tokens moved in or out: any ERC-20, plus stock tokens with their underlying-share amount merged in."],
  ["NATIVE_TRANSFER", "Plain ETH sent or received, with no token contract involved."],
  ["SWAP", "A trade on Uniswap v2, v3 or v4, or any pool that speaks the same events."],
  ["LP_ADD · LP_REMOVE", "Liquidity deposited into or pulled out of a pool."],
  ["LP_NFT_TRANSFER", "A v3/v4 position NFT opened, closed or handed to someone else."],
  ["CONTRACT_CALL", "The wallet called a contract that emitted nothing we recognise, logged by its function selector."],
];

const PHASES: { ph: string; dest: string; detail: string; status: "arrived" | "boarding" | "scheduled" }[] = [
  { ph: "01", dest: "Ingestion", detail: "Chain config, data adapters, event decoding, indexer, webhook", status: "arrived" },
  { ph: "02", dest: "Rules & alerts", detail: "Large transfers, new tokens, LP changes. Delivered to feed, email, Telegram", status: "boarding" },
  { ph: "03", dest: "Digests", detail: "Model router across cheap open models; a daily summary per wallet", status: "scheduled" },
  { ph: "04", dest: "Chat", detail: "Ask questions about a wallet; answers cite the transactions they came from", status: "scheduled" },
  { ph: "05", dest: "Credits", detail: "Prepaid usage ledger with Stripe top-ups", status: "scheduled" },
  { ph: "06", dest: "Admin", detail: "Spend by model and tier, indexer lag, health", status: "scheduled" },
];

export default async function Home() {
  const s = await getIndexerStatus();
  const lag = describeLag(s);
  const running = s.ok && s.lagBlocks !== null;

  return (
    <>
      <SiteHeader current="home" />
      <Tape
        items={[
          <><b>CHAIN</b> 4663 · Robinhood Chain mainnet</>,
          <><b>BLOCK TIME</b> ~100 ms</>,
          <><b>INDEXER</b> <span className={running ? "live" : "warn"}>{lag}</span></>,
          <><b>WATCHING</b> {s.wallets.toLocaleString("en-US")} wallets</>,
          <><b>EVENTS DECODED</b> {s.events.toLocaleString("en-US")}</>,
          <><b>DEX</b> Uniswap v2 · v3 · v4</>,
          <><b>STOCK TOKENS</b> ERC-8056 aware</>,
          <><b>KEYS HELD</b> 0</>,
        ]}
      />

      <main>
        <div className="wrap hero">
          <div>
            <span className="label">Wallet intelligence · Robinhood Chain</span>
            <h1>
              Every move a wallet makes, <em>read back to you.</em>
            </h1>
            <p className="lede">
              Pick the wallets you care about: a fund, a whale, your own. The tracker follows them across Robinhood Chain and turns
              raw logs into a clean record of transfers, swaps, stock-token trades and liquidity moves. It only ever reads. It
              never holds a key or signs anything.
            </p>
            <div className="actions">
              <Link className="btn btn-solid" href="/feed">Open the live feed →</Link>
              <Link className="btn btn-line" href="/docs">Read the docs</Link>
            </div>
          </div>

          <figure className="specimen" aria-label="Example of how a transaction is decoded">
            <div className="specimen-head">
              <span>tx 0x9f3c…e21a · block 18,402,117</span>
              <span className="stamp">Specimen</span>
            </div>
            <ol>
              <li>
                <div className="raw">topic0 <mark>0xddf252ad</mark>…b3ef<br />from 0x7a2f…whale<br />data 0x…2155a0c5</div>
                <div className="note"><b>Transfer</b>2.40 WETH leaves whale #1</div>
              </li>
              <li>
                <div className="raw">topic0 <mark>0xc42079f9</mark>…ca67<br />pool 0x51e8…4b0d<br />amount0 +2.4e18</div>
                <div className="note"><b>Swap · uniswap-v3</b>The pool takes the WETH and prices the trade</div>
              </li>
              <li>
                <div className="raw">topic0 <mark>0xddf252ad</mark>…b3ef<br />to 0x7a2f…whale<br />data 0x…248f</div>
                <div className="note"><b>Transfer</b>9,812.55 USDC lands back in whale #1</div>
              </li>
            </ol>
            <p className="readout">
              <span className="label">Read back</span>
              “Whale #1 swapped 2.40 ETH for 9,812.55 USDC on Uniswap v3.”
            </p>
            <span className="fine">Illustrative. The amounts are made up; the decoding is real.</span>
          </figure>
        </div>

        <section className="section">
          <div className="wrap bignum">
            <strong>864<span>,</span>000</strong>
            <div>
              <p>
                blocks a day. Robinhood Chain seals one roughly every tenth of a second. Reading all of them to follow a handful of
                wallets would be slow and expensive, so we don’t. <span className="accent">We read only the transactions your wallets touch.</span>
              </p>
              <p className="math">86,400 s ÷ 0.1 s per block = 864,000</p>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <div className="wrap">
            <div className="section-head">
              <span className="label">How it works</span>
              <div>
                <h2>Four steps from a block to a sentence.</h2>
                <p>A background indexer runs this loop every few seconds for each chain. Real-time webhooks run the same pipeline the moment activity lands.</p>
              </div>
            </div>
            <ol className="ledger">
              {STEPS.map((st) => (
                <li key={st.title}>
                  <span className="num">{st.n}</span>
                  <div>
                    <h3>{st.title}</h3>
                    <p>{st.body}</p>
                  </div>
                  <span className="margin">{st.margin}</span>
                </li>
              ))}
            </ol>
            <div className="aside-strip">
              <span className="label">Belt & braces</span>
              <span>Alchemy webhooks push new activity instantly. The polling indexer is the safety net that catches anything a webhook dropped.</span>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <span className="label">What it reads</span>
              <div>
                <h2>A small vocabulary for everything a wallet does on-chain.</h2>
                <p>
                  Stock tokens get extra care: their Chainlink prices only move while US markets are open, so any price read outside NYSE
                  hours is flagged as possibly stale.
                </p>
              </div>
            </div>
            <div className="vocab">
              {VOCAB.map(([k, v]) => (
                <div key={k}>
                  <code>{k}</code>
                  <p>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="access">
          <div className="wrap">
            <div className="section-head">
              <span className="label">Using it today</span>
              <div>
                <h2>Three ways in, while it’s still early.</h2>
                <p>This is Phase 1 of 6. The engine works; accounts and alerts come next. Here’s what you can do right now.</p>
              </div>
            </div>
            <div className="tickets">
              <div className="ticket">
                <span className="who">Anyone</span>
                <h3>Watch the live feed</h3>
                <p>Every decoded event for the wallets on the watchlist, newest first, each linked to the block explorer.</p>
                <Link className="go" href="/feed">Open the feed →</Link>
              </div>
              <div className="ticket">
                <span className="who">Wallet watchers</span>
                <h3>Get a wallet on the list</h3>
                <p>There’s no sign-up yet. The operator adds wallets with a label, and the indexer picks them up on its next pass.</p>
                <Link className="go" href="/docs#watch-a-wallet">How wallets are added →</Link>
              </div>
              <div className="ticket">
                <span className="who">Builders</span>
                <h3>Run your own</h3>
                <p>Postgres, Redis and two processes. Run it on your machine or deploy it to Railway in a few minutes.</p>
                <Link className="go" href="/docs#quickstart">Self-host guide →</Link>
              </div>
            </div>
            <p className="not-yet">Not yet: wallet sign-in, adding wallets yourself, alerts, digests, chat. All on the board below.</p>
          </div>
        </section>

        <section className="section" id="roadmap">
          <div className="wrap">
            <div className="section-head">
              <span className="label">Roadmap</span>
              <div>
                <h2>Six stops. The first one is behind us.</h2>
              </div>
            </div>
            <div className="board">
              <div className="board-top">
                <span>Departures · Agentic Wallet Tracker</span>
                <span>Platform 4663</span>
              </div>
              <table>
                <thead>
                  <tr><th>Ph.</th><th>Destination</th><th style={{ textAlign: "right" }}>Status</th></tr>
                </thead>
                <tbody>
                  {PHASES.map((p) => (
                    <tr key={p.ph}>
                      <td className="ph">{p.ph}</td>
                      <td className="dest">{p.dest}<small>{p.detail}</small></td>
                      <td className={`st st-${p.status}`}>{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <span className="label">Principles</span>
            <blockquote className="pull" style={{ marginTop: 20 }}>
              “We never ask for a key. We never sign a transaction. If it isn’t on the chain, we don’t know it.”
            </blockquote>
            <div className="pull-notes">
              <span>No private keys anywhere in the system</span>
              <span>Webhooks verified with HMAC before anything runs</span>
              <span>Every event links back to its transaction</span>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
