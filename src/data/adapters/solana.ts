import type { SolanaChainConfig } from "@/chains";
import type { SolanaParsedTx } from "../actions/solana";

// Highest transaction version we can parse. Solana added v1 transactions in 2026; older clients
// that only accept 0 get an error for them, so this has to keep up with the network.
const MAX_TX_VERSION = 1;
const PAGE = 1000;
const MAX_PAGES_PER_WALLET = 5; // a very busy wallet can't stall a tick; the rest is logged as skipped

/**
 * Solana JSON-RPC via Alchemy when ALCHEMY_API_KEY is set, otherwise the public endpoint (rate limited).
 * Wallet activity is found per wallet with getSignaturesForAddress, then each transaction is fetched parsed.
 */
export class SolanaAdapter {
  readonly name: string;
  private url: string;

  constructor(private chain: SolanaChainConfig, apiKey = process.env.ALCHEMY_API_KEY) {
    this.url = apiKey && chain.alchemyNetwork ? `https://${chain.alchemyNetwork}.g.alchemy.com/v2/${apiKey}` : chain.rpcUrl;
    this.name = apiKey ? "alchemy" : "rpc";
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (res.status === 429 && attempt < 4) { await new Promise((r) => setTimeout(r, 500 * 2 ** attempt)); continue; }
      const json = await res.json();
      if (json.error) {
        if (json.error.code === 429 && attempt < 4) { await new Promise((r) => setTimeout(r, 500 * 2 ** attempt)); continue; }
        throw new Error(`Solana ${method}: ${json.error.message}`);
      }
      return json.result as T;
    }
  }

  async getHead(): Promise<bigint> {
    return BigInt(await this.rpc<number>("getSlot", [{ commitment: "confirmed" }]));
  }

  /** Successful transaction signatures touching any of the wallets with slot in [fromSlot, toSlot]. */
  async findWalletTxs(wallets: string[], fromSlot: bigint, toSlot: bigint): Promise<string[]> {
    const out = new Set<string>();
    for (const wallet of wallets) {
      let before: string | undefined;
      for (let page = 0; page < MAX_PAGES_PER_WALLET; page++) {
        const sigs = await this.rpc<{ signature: string; slot: number; err: unknown }[]>("getSignaturesForAddress", [
          wallet, { limit: PAGE, commitment: "confirmed", ...(before ? { before } : {}) },
        ]);
        for (const s of sigs) if (!s.err && BigInt(s.slot) >= fromSlot && BigInt(s.slot) <= toSlot) out.add(s.signature);
        const oldest = sigs.at(-1);
        if (sigs.length < PAGE || !oldest || BigInt(oldest.slot) < fromSlot) break;
        before = oldest.signature;
        if (page === MAX_PAGES_PER_WALLET - 1) console.warn(`[solana] ${wallet}: more than ${PAGE * MAX_PAGES_PER_WALLET} txs in range, older ones skipped`);
      }
    }
    return [...out];
  }

  async getTx(signature: string): Promise<SolanaParsedTx | null> {
    return this.rpc<SolanaParsedTx | null>("getTransaction", [
      signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: MAX_TX_VERSION, commitment: "confirmed" },
    ]);
  }
}
