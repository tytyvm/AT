import type { Hex, TxContext } from "../types";

/**
 * Swap data providers by implementing this. The indexer only ever calls
 * these three methods, so moving from Alchemy to QuickNode/Goldsky/raw RPC
 * is one new file plus DATA_ADAPTER=... in .env.
 */
export interface ChainDataAdapter {
  readonly name: string;
  getHead(): Promise<bigint>;
  /** Tx hashes in [fromBlock, toBlock] where any wallet sent or received value. */
  findWalletTxs(wallets: string[], fromBlock: bigint, toBlock: bigint): Promise<Hex[]>;
  /** Full tx with receipt logs and block timestamp. */
  getTx(hash: Hex): Promise<TxContext>;
}
