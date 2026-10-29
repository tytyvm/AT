import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Replace these with real wallets you want to follow. Good sources: the
// "Top accounts" and recent large transfers on robinhoodchain.blockscout.com.
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
  const user = await prisma.user.upsert({ where: { email: "demo@example.com" }, create: { email: "demo@example.com" }, update: {} });
  for (const w of SAMPLE_WALLETS) {
    const address = w.address.toLowerCase();
    await prisma.watchedWallet.upsert({
      where: { userId_chainId_address: { userId: user.id, chainId: 4663, address } },
      create: { userId: user.id, chainId: 4663, address, label: w.label },
      update: { label: w.label },
    });
  }
  console.log("Seeded demo user with", SAMPLE_WALLETS.length, "wallets");
}
main().finally(() => prisma.$disconnect());
