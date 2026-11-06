import { PrismaClient } from "@prisma/client";
import { SHOWCASE_EMAIL } from "../src/lib/showcase";
import { parseWalletInput } from "../src/lib/watchlist";
const prisma = new PrismaClient();

// Showcase wallets for the public feed. Robinhood Chain (0x…) or Solana addresses; the chain is
// detected from the format. Good sources: "Top accounts" on robinhoodchain.blockscout.com, solscan.io.
// Avoid hyperactive bots here: each of their transactions costs data-provider calls.
const SAMPLE_WALLETS: { address: string; label: string }[] = [
  { address: "0x0000000000000000000000000000000000000001", label: "Replace me: whale #1" },
  { address: "0x0000000000000000000000000000000000000002", label: "Replace me: my wallet" },
];

// Stock tokens: copy addresses + Chainlink feeds from docs.robinhood.com/chain/contracts
// and /oracles-and-price-feeds. Stock tokens are ERC-20 with 18 decimals.
const STOCK_TOKENS: { address: string; symbol: string; priceFeed?: string }[] = [
  // { address: "0x...", symbol: "NVDA", priceFeed: "0x..." },
];

async function main() {
  await prisma.chain.upsert({
    where: { id: 4663 },
    create: { id: 4663, name: "Robinhood Chain", explorerUrl: "https://robinhoodchain.blockscout.com" },
    update: {},
  });
  await prisma.token.upsert({
    where: { chainId_address: { chainId: 4663, address: "0x0bd7d308f8e1639fab988df18a8011f41eacad73" } },
    create: { chainId: 4663, address: "0x0bd7d308f8e1639fab988df18a8011f41eacad73", symbol: "WETH", decimals: 18 },
    update: {},
  });
  for (const t of STOCK_TOKENS) {
    const address = t.address.toLowerCase();
    await prisma.token.upsert({
      where: { chainId_address: { chainId: 4663, address } },
      create: { chainId: 4663, address, symbol: t.symbol, decimals: 18, assetType: "STOCK_TOKEN", priceFeed: t.priceFeed },
      update: {},
    });
  }
  const user = await prisma.user.upsert({ where: { email: SHOWCASE_EMAIL }, create: { email: SHOWCASE_EMAIL }, update: {} });
  for (const w of SAMPLE_WALLETS) {
    const input = parseWalletInput(w.address, w.label);
    if (!input.ok) { console.warn(`Skipping ${w.address}: ${input.error}`); continue; }
    const { chainId, address, label } = input;
    await prisma.watchedWallet.upsert({
      where: { userId_chainId_address: { userId: user.id, chainId, address } },
      create: { userId: user.id, chainId, address, label },
      update: { label },
    });
  }
  console.log("Seeded showcase account with", SAMPLE_WALLETS.length, "wallets");
}
main().finally(() => prisma.$disconnect());
