import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../_components/chrome";

export const metadata: Metadata = { title: "Docs" };

const NAV: { group: string; items: [string, string][] }[] = [
  { group: "Getting started", items: [["introduction", "Introduction"], ["how-it-works", "How it works"], ["quickstart", "Quickstart"], ["deploy-railway", "Deploy on Railway"]] },
  { group: "Using the tracker", items: [["launch-app", "Launch the app"], ["sign-in", "Sign-in & privacy"], ["watch-a-wallet", "Watch a wallet"], ["live-feed", "Public feed"], ["event-types", "Event types"], ["stock-tokens", "Stock tokens"]] },
  { group: "Reference", items: [["configuration", "Configuration"], ["webhook-api", "Webhook API"], ["data-adapters", "Data adapters"], ["chains", "Adding a chain"], ["data-model", "Data model"]] },
  { group: "Project", items: [["model-router", "Model router"], ["security", "Security"], ["roadmap", "Roadmap"], ["limitations", "Known limitations"], ["faq", "FAQ"]] },
];

function Code({ label, children }: { label: string; children: string }) {
  return (
    <div className="code">
      <div className="code-label"><span>{label}</span></div>
      <pre><code>{children}</code></pre>
    </div>
  );
}

function Callout({ kind = "note", title, children }: { kind?: "note" | "warn"; title: string; children: React.ReactNode }) {
  return (
    <div className={`callout ${kind === "warn" ? "warn" : ""}`}>
      <b>{title}</b>
      <p>{children}</p>
    </div>
  );
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id}>
      <span className="eyebrow">{eyebrow}</span>
      <h2><a href={`#${id}`}>{title}</a></h2>
      {children}
    </section>
  );
}

export default function Docs() {
  return (
    <>
      <SiteHeader current="docs" />
      <div className="wrap docs">
        <aside className="docs-nav">
          <details open>
            <summary>Contents ▾</summary>
            <div className="nav-body">
              <span className="version">v0.1 · Phase 1</span>
              {NAV.map((g) => (
                <div key={g.group}>
                  <h4>{g.group}</h4>
                  <ul>
                    {g.items.map(([id, text]) => (
                      <li key={id}><a href={`#${id}`}>{text}</a></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        </aside>

        <article className="prose">
          <header>
            <span className="eyebrow">Documentation</span>
            <h1>Agentic Wallet Tracker</h1>
            <p>Read-only wallet tracking for Robinhood Chain. This guide covers what the tracker does, how to use it today, how to run your own copy, and the interfaces you can build on.</p>
          </header>

          {/* ---------------- Getting started ---------------- */}
          <Section id="introduction" eyebrow="Getting started" title="Introduction">
            <p>
              Agentic Wallet Tracker follows a set of wallets on <strong>Robinhood Chain</strong> (chain ID 4663) and records everything they do:
              token transfers, ETH sends, swaps, liquidity changes, LP position moves and stock-token trades. You open the{" "}
              <Link href="/app">app</Link>, add the wallets you care about, and their activity lands in your dashboard. Later phases add a{" "}
              <a href="#model-router">router of open-source models</a> that turns those events into alerts, daily digests and answers.
            </p>
            <p>The tracker is <strong>read-only by design</strong>. It never asks for a private key, never connects a wallet for signing, and never sends a transaction.</p>
            <Callout title="Status">
              The tracking engine and the app are live: sign in, build a watchlist, see decoded activity. Alerts, digests and the agent arrive
              in later phases. See the <a href="#roadmap">roadmap</a>.
            </Callout>
          </Section>

          <Section id="how-it-works" eyebrow="Getting started" title="How it works">
            <p>
              Robinhood Chain produces a block roughly every 100 ms, about 864,000 a day. Scanning every block to follow a few wallets would be
              slow and expensive, so the tracker filters by wallet first and only then reads the chain:
            </p>
            <ol className="steps">
              <li><strong>Find.</strong> Ask the data provider for transaction hashes that touch a watched wallet in a block range. The Alchemy adapter uses the Transfers API (which includes native ETH); the RPC adapter uses <code>eth_getLogs</code> filtered on the wallet in the Transfer topics.</li>
              <li><strong>Fetch.</strong> Load the receipt for each of those transactions, with every log and the block timestamp.</li>
              <li><strong>Decode.</strong> Match each log by event signature and turn it into a typed event. See <a href="#event-types">Event types</a>.</li>
              <li><strong>Store.</strong> Insert one row per wallet per log into <code>ChainEvent</code>. Inserts are idempotent, so replays are harmless.</li>
            </ol>
            <h3>Two ways in: push and poll</h3>
            <p>
              <strong>Webhook (push).</strong> Alchemy’s Address Activity webhook calls <code>/api/webhooks/alchemy</code> as soon as a watched
              wallet moves, and the tracker runs the pipeline on those transactions immediately.
            </p>
            <p>
              <strong>Indexer (poll).</strong> A background worker runs the pipeline every <code>INDEXER_POLL_MS</code> (5 seconds by default),
              scanning up to 50,000 blocks per pass from where it last stopped. It’s the safety net that catches anything a webhook dropped, and it
              backfills newly added wallets.
            </p>
          </Section>

          <Section id="quickstart" eyebrow="Getting started" title="Quickstart">
            <p>Run the whole stack on your own machine. You need Node.js 20 or newer, Docker, and optionally a free Alchemy account.</p>
            <Code label="Terminal">{`git clone <your fork of this repo> && cd AT
cp .env.example .env              # add ALCHEMY_API_KEY if you have one
docker compose up -d              # Postgres 16 + Redis 7
npm install                       # also generates the Prisma client
npx prisma migrate deploy         # create the tables
npm run db:seed                   # edit prisma/seed.ts first: add real wallets

npm run worker                    # terminal 1: the indexer
npm run dev                       # terminal 2: http://localhost:3000`}</Code>
            <p>Open <code>http://localhost:3000/feed</code>. Within a few seconds the indexer gauge should show a lag in seconds instead of “not started”.</p>
            <Callout title="No Alchemy key?">
              The tracker falls back to the public Robinhood Chain RPC. It works, but it’s rate limited and can’t see plain ETH sends that move no
              tokens. Set <code>DATA_ADAPTER=rpc</code> to choose it explicitly.
            </Callout>
            <Code label="Checks">{`npm run typecheck
npm test                          # decoder, market hours, webhook signature`}</Code>
          </Section>

          <Section id="deploy-railway" eyebrow="Getting started" title="Deploy on Railway">
            <p>Production runs as two services built from the same repository, sharing one Postgres and one Redis database.</p>
            <div className="ref-scroll">
              <table className="ref">
                <thead><tr><th>Service</th><th>Config file</th><th>Runs</th><th>Public URL</th></tr></thead>
                <tbody>
                  <tr><td><code>web</code></td><td><code>railway.json</code> (default)</td><td>Applies migrations, then serves the site and webhook</td><td>Yes</td></tr>
                  <tr><td><code>worker</code></td><td><code>/railway.worker.json</code></td><td>The indexer loop (<code>npm run worker</code>)</td><td>No</td></tr>
                </tbody>
              </table>
            </div>
            <ol className="steps">
              <li>Create a project, then add <strong>PostgreSQL</strong> and <strong>Redis</strong> from <em>+ Add → Database</em>.</li>
              <li>Add the repository as a service named <code>web</code>. Under <em>Settings → Networking</em>, generate a domain.</li>
              <li>Add the same repository again as a service named <code>worker</code>. Under <em>Settings → Config-as-code</em>, set the path to <code>/railway.worker.json</code>.</li>
              <li>On <strong>both</strong> services, set <code>DATABASE_URL</code> to <code>{"${{Postgres.DATABASE_URL}}"}</code> and <code>REDIS_URL</code> to <code>{"${{Redis.REDIS_URL}}"}</code>, plus any optional variables from <a href="#configuration">Configuration</a>.</li>
              <li>Deploy. The worker’s logs should print <code>Indexer running for chains: Robinhood Chain</code>.</li>
            </ol>
            <Callout kind="warn" title="Most common mistake">
              If the worker’s logs show <code>next start</code> or <code>Ready in …ms</code>, it’s running the website instead of the indexer.
              Its config-as-code path isn’t set to <code>/railway.worker.json</code>.
            </Callout>
          </Section>

          {/* ---------------- Using the tracker ---------------- */}
          <Section id="launch-app" eyebrow="Using the tracker" title="Launch the app">
            <p>Click <strong>Launch app</strong> on the home page, or go straight to <Link href="/app">/app</Link>.</p>
            <ol className="steps">
              <li><strong>Sign in.</strong> Connect a browser wallet and sign a free message, or continue anonymously. See <a href="#sign-in">Sign-in &amp; privacy</a>.</li>
              <li><strong>Add wallets.</strong> Paste an address, give it a label if you like, and press <em>Watch wallet</em>. You can watch up to 25.</li>
              <li><strong>Watch the activity.</strong> Transfers, swaps and liquidity moves from your wallets appear in the Activity column, newest first, each linked to the explorer.</li>
            </ol>
            <Callout title="From the moment you add it">
              The indexer picks up a new wallet on its next pass, within seconds, and records activity from then on. Older history isn’t
              backfilled automatically yet.
            </Callout>
          </Section>

          <Section id="sign-in" eyebrow="Using the tracker" title="Sign-in & privacy">
            <p>There are no emails, passwords or profiles. You choose how much to reveal:</p>
            <div className="ref-scroll">
              <table className="ref">
                <thead><tr><th>Mode</th><th>How it works</th><th>What we store</th></tr></thead>
                <tbody>
                  <tr><td><strong>Wallet</strong></td><td>Your wallet signs a Sign-In with Ethereum (EIP-4361) message. It’s free, sends no transaction and grants no spending rights.</td><td>Your public address and your watchlist.</td></tr>
                  <tr><td><strong>Anonymous</strong></td><td>A random workspace tied to this browser’s cookie. Nothing identifies you.</td><td>Only your watchlist.</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              Started anonymously and want to keep your list? Press <strong>Connect wallet &amp; keep list</strong> in the dashboard. The workspace
              is upgraded in place; if that wallet already has a list, the two are merged. Signing out of an anonymous workspace deletes it.
            </p>
            <p>
              Sessions last 30 days. The cookie holds a random key, and the server stores only its SHA-256 hash. Smart-contract wallets
              (Safe and similar) aren’t supported for sign-in yet.
            </p>
            <Callout kind="warn" title="Check what you sign">
              The sign-in message names this site and says it grants no spending rights. If your wallet ever shows a transaction, an
              approval or a different site, reject it.
            </Callout>
          </Section>

          <Section id="watch-a-wallet" eyebrow="Using the tracker" title="Watch a wallet">
            <p>
              In the app, paste any Robinhood Chain address into <em>Wallet address</em>, add an optional label (up to 40 characters) and press{" "}
              <em>Watch wallet</em>. Addresses are case-insensitive, and adding the same wallet twice is caught. Remove one at any time with{" "}
              <em>Remove</em>.
            </p>
            <p>Good places to find active wallets: “Top accounts” and recent large transfers on <code>robinhoodchain.blockscout.com</code>.</p>
            <h3>For operators: seeding wallets in bulk</h3>
            <p>To preload wallets on a fresh install (for a demo, say), list them in <code>prisma/seed.ts</code> and run the seed:</p>
            <Code label="Terminal">{`# Local
npm run db:seed

# Railway: copy DATABASE_PUBLIC_URL from the Postgres service's Variables tab
DATABASE_URL="postgresql://…proxy.rlwy.net:…/railway" npm run db:seed`}</Code>
            <p>
              Seeded wallets belong to a demo user and appear in the public feed. With <code>INDEXER_START_BLOCK=latest</code> (the default), a
              fresh indexer records activity from the moment it starts; set a block number to backfill history.
            </p>
          </Section>

          <Section id="live-feed" eyebrow="Using the tracker" title="Public feed">
            <p>
              <Link href="/feed">/feed</Link> is a public, read-only view of the latest 100 decoded events across everyone’s watched wallets, newest first. It shows what the indexer is doing without signing in. Wallets show their label
              when they have one. Every transaction links to <code>robinhoodchain.blockscout.com</code> so you can verify it independently.
            </p>
            <div className="ref-scroll">
              <table className="ref">
                <thead><tr><th>Gauge</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr><td>Indexer</td><td>How far the indexer trails the chain head, in seconds. “not started” means the worker hasn’t completed a pass.</td></tr>
                  <tr><td>Last block</td><td>The highest block the indexer has fully processed.</td></tr>
                  <tr><td>Wallets</td><td>Wallets on the watchlist for this chain.</td></tr>
                  <tr><td>Events</td><td>Total decoded events stored.</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="event-types" eyebrow="Using the tracker" title="Event types">
            <p>Logs are matched by event signature, not contract address, so any Uniswap-compatible fork on any EVM chain decodes the same way.</p>
            <div className="ref-scroll">
              <table className="ref">
                <thead><tr><th>Kind</th><th>Source</th><th>Payload</th></tr></thead>
                <tbody>
                  <tr><td><code>TRANSFER</code></td><td>ERC-20 <code>Transfer</code>, stock-token <code>TransferWithScaledUI</code></td><td>token, from, to, amount, uiAmount (stock tokens)</td></tr>
                  <tr><td><code>NATIVE_TRANSFER</code></td><td>Transaction value (ETH)</td><td>from, to, amount</td></tr>
                  <tr><td><code>SWAP</code></td><td>Uniswap v2, v3, v4 <code>Swap</code></td><td>protocol, pool, amounts</td></tr>
                  <tr><td><code>LP_ADD</code> / <code>LP_REMOVE</code></td><td>v2 <code>Mint</code>/<code>Burn</code>, v3 <code>Mint</code>/<code>Burn</code>, v4 <code>ModifyLiquidity</code></td><td>protocol, pool, details</td></tr>
                  <tr><td><code>LP_NFT_TRANSFER</code></td><td>ERC-721 <code>Transfer</code> (4 topics)</td><td>contract, from, to, tokenId</td></tr>
                  <tr><td><code>CONTRACT_CALL</code></td><td>Calls that emitted nothing recognised</td><td>to, selector</td></tr>
                </tbody>
              </table>
            </div>
            <p>Amounts are stored as strings in base units to avoid precision loss. Each event is unique on <code>(chainId, txHash, logIndex, wallet)</code>; non-log events use <code>logIndex = -1</code>.</p>
          </Section>

          <Section id="stock-tokens" eyebrow="Using the tracker" title="Stock tokens">
            <p>
              Robinhood Chain stock tokens are ERC-20s with 18 decimals that implement <strong>ERC-8056</strong>, a corporate-action multiplier for
              splits and dividends. Their transfers emit <code>TransferWithScaledUI</code> alongside the normal <code>Transfer</code>; the decoder
              merges the two so nothing is double counted and the underlying-share amount is kept as <code>uiAmount</code>.
            </p>
            <p>
              Each stock token has a Chainlink price feed that only moves while US markets trade. Any price read outside NYSE regular hours
              (Mon–Fri 9:30–16:00 New York, excluding holidays) is flagged <em>may be stale</em>.
            </p>
            <Callout title="Detection">
              Stock tokens mostly trade through RFQ, Rialto’s propAMM and Lighter rather than Uniswap, so a purchase is detected from the
              transfers into the wallet, not only from swap events.
            </Callout>
          </Section>

          {/* ---------------- Reference ---------------- */}
          <Section id="configuration" eyebrow="Reference" title="Configuration">
            <p>All configuration is through environment variables. Never commit <code>.env</code>.</p>
            <div className="ref-scroll">
              <table className="ref">
                <thead><tr><th>Variable</th><th>Required</th><th>Default</th><th>Description</th></tr></thead>
                <tbody>
                  <tr><td><code>DATABASE_URL</code></td><td>Yes</td><td>—</td><td>Postgres connection string.</td></tr>
                  <tr><td><code>REDIS_URL</code></td><td>Yes</td><td><code>redis://localhost:6379</code></td><td>Redis for the BullMQ job queue.</td></tr>
                  <tr><td><code>DATA_ADAPTER</code></td><td>No</td><td><code>alchemy</code></td><td><code>alchemy</code> or <code>rpc</code>. Alchemy needs a key, otherwise RPC is used.</td></tr>
                  <tr><td><code>ALCHEMY_API_KEY</code></td><td>Recommended</td><td>—</td><td>From dashboard.alchemy.com, app on Robinhood Chain mainnet.</td></tr>
                  <tr><td><code>ALCHEMY_WEBHOOK_SIGNING_KEY</code></td><td>For real-time</td><td>—</td><td>Signing key from the Alchemy webhook page.</td></tr>
                  <tr><td><code>ROBINHOOD_RPC_URL</code></td><td>No</td><td>public RPC</td><td>Override the rate-limited public RPC.</td></tr>
                  <tr><td><code>INDEXER_POLL_MS</code></td><td>No</td><td><code>5000</code></td><td>Interval between indexer passes.</td></tr>
                  <tr><td><code>INDEXER_START_BLOCK</code></td><td>No</td><td><code>latest</code></td><td>Block to start from on the very first run.</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="webhook-api" eyebrow="Reference" title="Webhook API">
            <p>Receives Alchemy Address Activity notifications and ingests the referenced transactions immediately.</p>
            <Code label="Endpoint">{`POST /api/webhooks/alchemy
Header: x-alchemy-signature: <hex HMAC-SHA256 of the raw body>`}</Code>
            <div className="ref-scroll">
              <table className="ref">
                <thead><tr><th>Status</th><th>Body</th><th>When</th></tr></thead>
                <tbody>
                  <tr><td><code>200</code></td><td><code>{`{ "ok": true, "saved": 3 }`}</code></td><td>Signature valid; <code>saved</code> is the number of new events.</td></tr>
                  <tr><td><code>401</code></td><td><code>{`{ "error": "bad signature" }`}</code></td><td>Missing or invalid signature, or no signing key configured.</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              The signature is checked with a constant-time comparison before the body is parsed. Point the webhook at
              <code> https://&lt;your-domain&gt;/api/webhooks/alchemy</code> for Robinhood Chain mainnet. In Phase 1 the webhook’s address list is
              maintained by hand in the Alchemy dashboard.
            </p>
          </Section>

          <Section id="data-adapters" eyebrow="Reference" title="Data adapters">
            <p>Everything downstream sees provider-agnostic types. Switching providers is one new file plus <code>DATA_ADAPTER=…</code>.</p>
            <Code label="src/data/adapters/types.ts">{`export interface ChainDataAdapter {
  readonly name: string;
  getHead(): Promise<bigint>;
  /** Tx hashes in [fromBlock, toBlock] where any wallet sent or received value. */
  findWalletTxs(wallets: string[], fromBlock: bigint, toBlock: bigint): Promise<Hex[]>;
  /** Full tx with receipt logs and block timestamp. */
  getTx(hash: Hex): Promise<TxContext>;
}`}</Code>
            <p>Implement the three methods, register the adapter in <code>makeAdapter()</code> in <code>src/data/adapters/index.ts</code>, and set the variable.</p>
          </Section>

          <Section id="chains" eyebrow="Reference" title="Adding a chain">
            <ol className="steps">
              <li>Create <code>src/chains/&lt;name&gt;.ts</code> exporting a <code>ChainConfig</code>, using <code>robinhood.ts</code> as the template.</li>
              <li>Register it in <code>src/chains/index.ts</code>.</li>
              <li>That’s it. The decoder matches events by signature and the indexer schedules one job per registered chain.</li>
            </ol>
            <Code label="src/chains/robinhood.ts (excerpt)">{`export const robinhoodMainnet: ChainConfig = {
  id: 4663,
  name: "Robinhood Chain",
  nativeSymbol: "ETH",
  rpcUrl: process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
  alchemyNetwork: "robinhood-mainnet",
  explorer: { url: "https://robinhoodchain.blockscout.com", txPath: "/tx/", addressPath: "/address/" },
  blockTimeMs: 100,
  maxLogRange: 10_000,
  features: { stockTokens: true },
};`}</Code>
          </Section>

          <Section id="data-model" eyebrow="Reference" title="Data model">
            <p>Postgres via Prisma. The full schema is defined up front so later phases don’t need disruptive migrations.</p>
            <div className="ref-scroll">
              <table className="ref">
                <thead><tr><th>Table</th><th>Phase</th><th>Holds</th></tr></thead>
                <tbody>
                  <tr><td><code>Chain</code>, <code>Token</code></td><td>1</td><td>Supported chains; known tokens incl. stock tokens and their price feeds.</td></tr>
                  <tr><td><code>User</code>, <code>WatchedWallet</code></td><td>1</td><td>Owners (a wallet address, or none for anonymous) and the wallets they follow, with labels.</td></tr>
                  <tr><td><code>Session</code></td><td>1</td><td>Signed-in browsers, stored as hashed keys with an expiry.</td></tr>
                  <tr><td><code>ChainEvent</code></td><td>1</td><td>Every decoded event with its JSON payload.</td></tr>
                  <tr><td><code>IndexerCursor</code></td><td>1</td><td>Last processed block and chain head, per chain.</td></tr>
                  <tr><td><code>AlertRule</code>, <code>Alert</code></td><td>2</td><td>User rules and the alerts they produced.</td></tr>
                  <tr><td><code>AiCall</code>, <code>CreditEntry</code></td><td>3, 5</td><td>Model usage and cost; the prepaid credit ledger.</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* ---------------- Project ---------------- */}
          <Section id="model-router" eyebrow="Project" title="Model router">
            <p>
              The core idea of the project: every job goes to the cheapest model that can do it well, and every model is open-weight, so it
              can run on any provider or on your own hardware. This arrives in Phase 3; the tiers below are the design.
            </p>
            <div className="ref-scroll">
              <table className="ref">
                <thead><tr><th>Tier</th><th>Handles</th><th>Runs on</th></tr></thead>
                <tbody>
                  <tr><td>0</td><td>Rule matches and alert text from templates, e.g. “whale #1 moved 50,000 USDC”.</td><td>No model at all.</td></tr>
                  <tr><td>1</td><td>Classifying events and writing short alert copy.</td><td>A small open model.</td></tr>
                  <tr><td>2</td><td>Daily digests and questions that need tools (look up events, prices) with cited transactions.</td><td>A larger open model, only when needed.</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              Every call will be logged with its tier, model, tokens and cost (the <code>AiCall</code> table already exists), so you can see
              where spend goes. Local models run through Ollama; see <code>docker-compose.yml</code>.
            </p>
          </Section>

          <Section id="security" eyebrow="Project" title="Security">
            <ul>
              <li><strong>No private keys.</strong> The system has no code path that signs or sends a transaction.</li>
              <li><strong>Verified webhooks.</strong> Every webhook is checked with HMAC-SHA256 and a constant-time comparison before anything is processed.</li>
              <li><strong>Read-only sign-in.</strong> Wallet sign-in (SIWE, EIP-4361) proves ownership of an address with a signed message, checked server-side against a single-use nonce. It never grants spending rights.</li>
              <li><strong>Hashed sessions.</strong> Session cookies are HTTP-only; the database keeps only a SHA-256 hash of each session key.</li>
              <li><strong>Verifiable output.</strong> Every event links to its transaction on the public explorer.</li>
              <li><strong>Secrets stay out of git.</strong> Configuration lives in environment variables; <code>.env</code> is ignored.</li>
            </ul>
            <Callout kind="warn" title="Stay safe">
              Nobody working on this project will ever ask for your seed phrase or ask you to sign a transaction to “activate” tracking. Anyone who does is a scammer.
            </Callout>
          </Section>

          <Section id="roadmap" eyebrow="Project" title="Roadmap">
            <div className="ref-scroll">
              <table className="ref">
                <thead><tr><th>Phase</th><th>Scope</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td>1</td><td>Chain config, data adapters, event decoding, indexer, webhook, app with wallet sign-in and watchlists</td><td>Done</td></tr>
                  <tr><td>2</td><td>Rules engine and alerts (feed, email, Telegram); USD pricing; webhook address sync; history backfill for new wallets</td><td>Next</td></tr>
                  <tr><td>3</td><td>Model router (tier 0/1/2) and daily digests</td><td>Planned</td></tr>
                  <tr><td>4</td><td>Chat with tool calling and cited answers</td><td>Planned</td></tr>
                  <tr><td>5</td><td>Credits ledger, Stripe top-ups, payment-method interface</td><td>Planned</td></tr>
                  <tr><td>6</td><td>Admin: spend by tier and model, tier mix, indexer lag</td><td>Planned</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="limitations" eyebrow="Project" title="Known limitations">
            <ul>
              <li>Uniswap contract addresses for chain 4663 aren’t filled in yet. Decoding works without them; they’re only used to tag “known DEX”.</li>
              <li>Stock-token addresses and price feeds must be added to <code>prisma/seed.ts</code> from docs.robinhood.com/chain/contracts.</li>
              <li>The RPC adapter doesn’t see native ETH sends that move no tokens. The Alchemy adapter does.</li>
              <li>USD values aren’t computed at ingest yet. Pricing arrives in Phase 2.</li>
              <li>Webhook addresses are configured by hand in Alchemy until Phase 2 syncs them.</li>
              <li>The NYSE holiday list in <code>src/prices/market-hours.ts</code> needs a yearly update.</li>
            </ul>
          </Section>

          <Section id="faq" eyebrow="Project" title="FAQ">
            <div className="faq">
              <details>
                <summary>Does the tracker ever hold or move funds?</summary>
                <p>No. It only reads public chain data. There is no wallet connection for signing and no private key anywhere in the system.</p>
              </details>
              <details>
                <summary>The feed says “indexer: not started”. What’s wrong?</summary>
                <p>
                  The worker hasn’t completed a pass. Check that a separate worker service exists, that its config points to
                  <code> /railway.worker.json</code>, and that its logs show <code>Indexer running</code> without <code>index job failed</code> errors.
                  It also needs the same <code>DATABASE_URL</code> and <code>REDIS_URL</code> as the web service.
                </p>
              </details>
              <details>
                <summary>The indexer is running but my activity is empty.</summary>
                <p>Your wallets haven’t moved since you added them. Activity is recorded from the moment a wallet is added, so pick active wallets (see <a href="#watch-a-wallet">Watch a wallet</a>), or, as an operator, set <code>INDEXER_START_BLOCK</code> to backfill.</p>
              </details>
              <details>
                <summary>Which wallets can I track?</summary>
                <p>Any address on Robinhood Chain. Wallet activity is public; the tracker organizes it, it doesn’t reveal anything that isn’t already on-chain.</p>
              </details>
              <details>
                <summary>Do I need a wallet to use the app?</summary>
                <p>No. Continue anonymously and your watchlist lives in that browser. Connect a wallet any time to keep it across devices.</p>
              </details>
              <details>
                <summary>Why are there no USD values?</summary>
                <p>Pricing is part of Phase 2. Phase 1 stores exact token amounts so values can be computed later without re-indexing.</p>
              </details>
              <details>
                <summary>Is this an official Robinhood product?</summary>
                <p>No. It’s an independent project built on Robinhood Chain’s public network and is not affiliated with or endorsed by Robinhood Markets, Inc.</p>
              </details>
            </div>
          </Section>
        </article>
      </div>
      <SiteFooter />
    </>
  );
}
