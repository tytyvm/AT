import { createPublicClient, hexToString, http, parseAbi, type Hex } from "viem";
import type { EvmChainConfig } from "@/chains";
import { prisma } from "@/lib/db";
import type { TokenMeta } from "./actions/classify";

const ERC20 = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)"]);
const ERC20_BYTES32 = parseAbi(["function symbol() view returns (bytes32)"]);

/** Reads symbol/decimals from the contract. Handles bytes32 symbols (old tokens); unknowns come back null. */
export async function readTokenMeta(chain: EvmChainConfig, address: string): Promise<TokenMeta> {
  const client = createPublicClient({ transport: http(chain.rpcUrl, { retryCount: 2 }) });
  const token = address as Hex;
  const [decimals, symbol] = await Promise.all([
    client.readContract({ address: token, abi: ERC20, functionName: "decimals" }).then(Number).catch(() => null),
    client.readContract({ address: token, abi: ERC20, functionName: "symbol" }).catch(() =>
      client.readContract({ address: token, abi: ERC20_BYTES32, functionName: "symbol" }).then((b) => hexToString(b, { size: 32 }).replace(/\0/g, "")).catch(() => null)),
  ]);
  return { symbol: symbol ? symbol.slice(0, 32) : null, decimals };
}

/** Symbol/decimals for many tokens: database cache first, then the chain. Newly read tokens are saved. */
export async function tokenMetas(chain: EvmChainConfig, addresses: string[]): Promise<Map<string, TokenMeta>> {
  const out = new Map<string, TokenMeta>();
  if (!addresses.length) return out;
  const known = await prisma.token.findMany({ where: { chainId: chain.id, address: { in: addresses } } });
  for (const t of known) out.set(t.address, { symbol: t.symbol, decimals: t.decimals });
  const missing = addresses.filter((a) => !out.has(a));
  await Promise.all(missing.map(async (address) => {
    const m = await readTokenMeta(chain, address);
    out.set(address, m);
    if (m.symbol !== null && m.decimals !== null) {
      await prisma.chain.upsert({ where: { id: chain.id }, create: { id: chain.id, name: chain.name, explorerUrl: chain.explorer.url }, update: {} });
      await prisma.token.upsert({
        where: { chainId_address: { chainId: chain.id, address } },
        create: { chainId: chain.id, address, symbol: m.symbol, decimals: m.decimals },
        update: {},
      });
    }
  }));
  return out;
}
