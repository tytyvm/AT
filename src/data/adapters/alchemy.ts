import type { ChainConfig } from "@/chains";
import type { Hex } from "../types";
import { RpcAdapter } from "./rpc";

/**
 * Alchemy officially supports Robinhood Chain mainnet (RPC, Transfers API,
 * Webhooks). We use alchemy_getAssetTransfers to find wallet txs, including
 * native ETH ("external"), then reuse the RPC adapter's receipt decoding
 * against the Alchemy endpoint. Real-time pushes come in through the
 * webhook route (src/app/api/webhooks/alchemy/route.ts).
 */
export class AlchemyAdapter extends RpcAdapter {
  readonly name = "alchemy";
  private url: string;

  constructor(chain: ChainConfig, apiKey: string) {
    if (!chain.alchemyNetwork) throw new Error(`Alchemy doesn't support ${chain.name}`);
    const url = `https://${chain.alchemyNetwork}.g.alchemy.com/v2/${apiKey}`;
    super(chain, url);
    this.url = url;
  }

  async findWalletTxs(wallets: string[], fromBlock: bigint, toBlock: bigint): Promise<Hex[]> {
    const hashes = new Set<Hex>();
    for (const w of wallets) {
      for (const dir of ["fromAddress", "toAddress"] as const) {
        let pageKey: string | undefined;
        do {
          const res = await fetch(this.url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers",
              params: [{
                fromBlock: `0x${fromBlock.toString(16)}`, toBlock: `0x${toBlock.toString(16)}`,
                [dir]: w, category: ["external", "erc20", "erc721"],
                withMetadata: false, maxCount: "0x3e8", ...(pageKey ? { pageKey } : {}),
              }],
            }),
          });
          const json = await res.json();
          if (json.error) throw new Error(`Alchemy: ${json.error.message}`);
          for (const t of json.result.transfers) hashes.add(t.hash);
          pageKey = json.result.pageKey;
        } while (pageKey);
      }
    }
    return [...hashes];
  }
}
