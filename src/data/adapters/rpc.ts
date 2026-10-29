import { createPublicClient, http, pad, type PublicClient } from "viem";
import type { ChainConfig } from "@/chains";
import type { Hex, TxContext } from "../types";
import type { ChainDataAdapter } from "./types";
import { TOPIC } from "../decode";

/**
 * Plain JSON-RPC adapter (viem). Works with any provider's endpoint.
 * Strategy: filter Transfer logs by wallet in topics (cheap, server-side),
 * then fetch receipts only for matching txs and decode everything in them.
 * Limitation: native ETH sends with no token movement aren't found by log
 * filters. The Alchemy adapter covers those via its Transfers API.
 */
export class RpcAdapter implements ChainDataAdapter {
  readonly name: string = "rpc";
  protected client: PublicClient;
  private blockTs = new Map<bigint, Date>();

  constructor(protected chain: ChainConfig, rpcUrl = chain.rpcUrl) {
    this.client = createPublicClient({ transport: http(rpcUrl, { batch: true, retryCount: 3 }) });
  }

  getHead() { return this.client.getBlockNumber(); }

  async findWalletTxs(wallets: string[], fromBlock: bigint, toBlock: bigint): Promise<Hex[]> {
    if (!wallets.length) return [];
    const padded = wallets.map((w) => pad(w as Hex, { size: 32 }));
    const hashes = new Set<Hex>();
    const step = BigInt(this.chain.maxLogRange - 1);
    for (let start = fromBlock; start <= toBlock; start += step + 1n) {
      const end = start + step > toBlock ? toBlock : start + step;
      for (const topics of [[TOPIC.TRANSFER, padded], [TOPIC.TRANSFER, null, padded]] as const) {
        const logs = await this.client.request({
          method: "eth_getLogs",
          params: [{ fromBlock: `0x${start.toString(16)}`, toBlock: `0x${end.toString(16)}`, topics: topics as any }],
        });
        for (const l of logs as any[]) hashes.add(l.transactionHash);
      }
    }
    return [...hashes];
  }

  async getTx(hash: Hex): Promise<TxContext> {
    const [tx, receipt] = await Promise.all([
      this.client.getTransaction({ hash }),
      this.client.getTransactionReceipt({ hash }),
    ]);
    let ts = this.blockTs.get(receipt.blockNumber);
    if (!ts) {
      const block = await this.client.getBlock({ blockNumber: receipt.blockNumber });
      ts = new Date(Number(block.timestamp) * 1000);
      if (this.blockTs.size > 5000) this.blockTs.clear();
      this.blockTs.set(receipt.blockNumber, ts);
    }
    return {
      hash, from: tx.from, to: tx.to ?? null, value: tx.value, input: tx.input,
      blockNumber: receipt.blockNumber, timestamp: ts,
      logs: receipt.logs.map((l) => ({
        address: l.address, topics: l.topics as Hex[], data: l.data,
        logIndex: l.logIndex, transactionHash: hash, blockNumber: l.blockNumber,
      })),
    };
  }
}
