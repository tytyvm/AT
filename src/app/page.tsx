import Link from "next/link";
import { SiteFooter, SiteHeader, Tape } from "./_components/chrome";
import { describeLag, getAllStatuses, isRunning } from "@/lib/status";

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

const ROUTES: { job: string; tier: 0 | 1 | 2; how: string }[] = [
  { job: "Whale #1 moved 50,000 USDC to a new address", tier: 0, how: "Rule + template. No model, no cost." },
  { job: "Is this the first time they’ve touched this token?", tier: 1, how: "Small open model classifies the event." },
  { job: "Summarise what my wallets did today", tier: 2, how: "Larger open model writes the digest." },
  { job: "Why is whale #1 rotating out of stock tokens?", tier: 2, how: "Agent queries events and prices, cites each tx." },
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
  const statuses = await getAllStatuses();
  const wallets = statuses.reduce((n, s) => n + s.wallets, 0);
  const actions = statuses.reduce((n, s) => n + s.actions, 0);

  return (
    <>
      <SiteHeader current="home" />
      <Tape
        items={[
          <><b>CHAINS</b> Robinhood Chain · Solana</>,
          ...statuses.map((s) => <><b>{s.chain.name.toUpperCase()}</b> <span className={isRunning(s) ? "live" : "warn"}>{describeLag(s)}</span></>),
          <><b>WATCHING</b> {wallets.toLocaleString("en-US")} wallets</>,
          <><b>ACTIONS RECORDED</b> {actions.toLocaleString("en-US")}</>,
          <><b>VENUES</b> Uniswap · Jupiter · Raydium · pump.fun</>,
          <><b>DEX</b> Uniswap v2 · v3 · v4</>,
          <><b>STOCK TOKENS</b> ERC-8056 aware</>,
          <><b>KEYS HELD</b> 0</>,
        ]}
      />

      <main>
        <div className="wrap hero">
          <div>
            <span className="label">Agentic wallet tracking · Robinhood Chain + Solana</span>
            <h1>
              Every move a wallet makes, <em>read back to you.</em>
            </h1>
            <p className="lede">
              Pick the wallets you care about: a fund, a whale, your own. The tracker follows them across Robinhood Chain and Solana, and a
              router of open-source models turns what they do into alerts, digests and answers. It’s cheap, it’s anonymous, and it
              only ever reads: no email, no keys, no transactions.
            </p>
            <div className="actions">
              <Link className="btn btn-solid" href="/app">Launch app →</Link>
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
                blocks a day on Robinhood Chain alone, one roughly every tenth of a second; Solana adds over 200,000 slots. Reading
                all of them to follow a handful of wallets would be slow and expensive, so we don’t. <span className="accent">We read only the transactions your wallets touch.</span>
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

        <section className="section" id="router">
          <div className="wrap">
            <div className="section-head">
              <span className="label">The model router</span>
              <div>
                <h2>Every job goes to the cheapest model that can do it.</h2>
                <p>
                  Most of what a wallet does doesn’t need AI at all, and most of the rest doesn’t need a big model. The router sends each job to the
                  smallest tier that can handle it, using open-weight models that can run anywhere, including your own machine.
                </p>
              </div>
            </div>
            <div className="switchboard">
              {ROUTES.map((r) => (
                <div className="route" key={r.job}>
                  <span className="job">“{r.job}”</span>
                  <span className="leader" aria-hidden="true" />
                  <span className={`tier tier-${r.tier}`}>
                    <b>Tier {r.tier}</b>
                    {r.how}
                  </span>
                </div>
              ))}
            </div>
            <dl className="tenets">
              <div><dt>Cheap</dt><dd>Templates first, small models next, large models only when a question needs them.</dd></div>
              <div><dt>Anonymous</dt><dd>No email or password. Sign in with a wallet signature, or not at all.</dd></div>
              <div><dt>Open</dt><dd>Open-weight models on interchangeable providers, so no single company sits in the middle.</dd></div>
              <div><dt>Agentic</dt><dd>The agent can look up events and prices itself, and every answer cites its transactions.</dd></div>
            </dl>
            <p className="not-yet">The router arrives in Phase 3. Today the app tracks wallets and decodes their activity; the models plug in on top.</p>
          </div>
        </section>

        <section className="section" id="access">
          <div className="wrap">
            <div className="section-head">
              <span className="label">Using it today</span>
              <div>
                <h2>Three ways in, while it’s still early.</h2>
                <p>The tracking engine works today. Alerts, digests and the agent come next. Here’s what you can do right now.</p>
              </div>
            </div>
            <div className="tickets">
              <div className="ticket">
                <span className="who">Anyone</span>
                <h3>Launch the app</h3>
                <p>Connect a wallet or stay anonymous, add the wallets you want to follow, and watch their activity land as it happens.</p>
                <Link className="go" href="/app">Launch app →</Link>
              </div>
              <div className="ticket">
                <span className="who">Onlookers</span>
                <h3>Browse the public feed</h3>
                <p>See everything the indexer has decoded across all watched wallets, newest first, each linked to the block explorer.</p>
                <Link className="go" href="/feed">Open the feed →</Link>
              </div>
              <div className="ticket">
                <span className="who">Builders</span>
                <h3>Run your own</h3>
                <p>Postgres, Redis and two processes. Run it on your machine or deploy it to Railway in a few minutes.</p>
                <Link className="go" href="/docs#quickstart">Self-host guide →</Link>
              </div>
            </div>
            <p className="not-yet">Not yet: alerts, digests and chat with the agent. All on the board below.</p>
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
