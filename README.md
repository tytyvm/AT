# Agentic Wallet Tracker

Watch wallets on Robinhood Chain and get alerts, daily digests, and chat answers
written by cheap open-source models. Read-only: the app never holds keys or signs
transactions.

**Status: Phase 1 of 6 complete** (chain config + data ingestion).

| Phase | What | Status |
|---|---|---|
| 1 | Chain config, data adapters, event decoding, indexer, webhook | ✅ done |
| 2 | Rules engine + alerts (feed, email, Telegram) | next |
| 3 | Model router (tier 0/1/2) + daily digests | |
| 4 | Chat with tool calling + cited answers | |
| 5 | Credits ledger + Stripe top-ups + PaymentMethod interface | |
| 6 | /admin (spend by tier/model, tier mix, indexer lag) | |

## Setup

You need Node 20+, Docker, and a free Alchemy account.

```bash
cp .env.example .env            # then fill in ALCHEMY_API_KEY
docker compose up -d            # Postgres + Redis
npm install
npx prisma migrate dev --name init
npm run db:seed                 # edit prisma/seed.ts first: put in real wallets
npm run worker                  # terminal 1: the indexer
npm run dev                     # terminal 2: http://localhost:3000
npm test                        # decoder, market hours, webhook signature tests
```

## Environment variables

| Var | Required | What it does |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `REDIS_URL` | yes | Redis for the BullMQ job queue |
| `DATA_ADAPTER` | no | `alchemy` (default) or `rpc` |
| `ALCHEMY_API_KEY` | recommended | From dashboard.alchemy.com, app on Robinhood Chain mainnet |
| `ALCHEMY_WEBHOOK_SIGNING_KEY` | for real-time | From the Alchemy webhook page |
| `ROBINHOOD_RPC_URL` | no | Override the public RPC (rate limited) |
| `INDEXER_POLL_MS` | no | Catch-up loop interval, default 5000 |
| `INDEXER_START_BLOCK` | no | Block to start from on first run, default `latest` |

## How ingestion works

Robinhood Chain makes a block roughly every 100 ms, so scanning every block
would be slow and expensive. Instead:

1. **Find** transactions that touch a watched wallet. Alchemy adapter: the
   Transfers API (includes native ETH). RPC adapter: `eth_getLogs` filtered by
   wallet address in the Transfer event topics.
2. **Fetch** receipts for only those transactions.
3. **Decode** every log in them: ERC-20 transfers, stock-token
   `TransferWithScaledUI` (merged in, so nothing is double counted),
   Uniswap v2/v3/v4 swaps and liquidity changes, and LP position NFT moves.
4. **Store** normalized events in `ChainEvent`. Inserts are idempotent, so
   replays and duplicate webhooks are harmless.

Alchemy's Address Activity webhook (`/api/webhooks/alchemy`) pushes new
activity in real time. The polling worker is the safety net that catches
anything a webhook missed.

## Stock tokens

Stock tokens are ERC-20s (18 decimals) with a Chainlink price feed each, and
implement ERC-8056 (a corporate-action multiplier). Their feeds only move
while US markets trade, so `src/prices/market-hours.ts` flags any price read
outside NYSE hours as "may be stale". The holiday list needs a yearly update.

They mostly trade via RFQ, Rialto's propAMM, and Lighter rather than Uniswap,
so "bought a stock token" is detected from transfers, not just swap events.

## Add a chain

1. Create `src/chains/<name>.ts` exporting a `ChainConfig` (see `robinhood.ts`).
2. Register it in `src/chains/index.ts`.
3. Done. The decoder matches events by signature, so any Uniswap-compatible
   DEX decodes without changes. The indexer starts a job per registered chain.

## Swap the data provider

Implement `ChainDataAdapter` (`src/data/adapters/types.ts`: three methods),
add it to `makeAdapter()` in `src/data/adapters/index.ts`, and set
`DATA_ADAPTER`. Nothing downstream changes.

## Known gaps (phase 1)

- Uniswap contract addresses for chain 4663 aren't filled in yet
  (`src/chains/robinhood.ts`). Decoding works without them; they're only for
  tagging "known DEX".
- Stock token addresses and price feeds go in `prisma/seed.ts`, copied from
  docs.robinhood.com/chain/contracts.
- The RPC adapter doesn't see native ETH sends that move no tokens. Alchemy does.
- USD values aren't computed at ingest yet (phase 2 adds pricing).
- Alchemy webhook addresses are configured by hand; phase 2 syncs them.

## Security

No private keys anywhere. Webhooks are verified with HMAC before anything is
processed. Never commit `.env`.
