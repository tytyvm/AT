// Provider-agnostic shapes. Every adapter returns these; nothing downstream
// (rules, digests, chat) ever sees provider-specific data.
export type Hex = `0x${string}`;

export interface RawLog {
  address: Hex;
  topics: Hex[];
  data: Hex;
  logIndex: number;
  transactionHash: Hex;
  blockNumber: bigint;
}

export interface TxContext {
  hash: Hex;
  from: Hex;
  to: Hex | null;
  value: bigint; // native ETH sent
  input: Hex;    // calldata ("0x" for plain transfers)
  blockNumber: bigint;
  timestamp: Date;
  logs: RawLog[];
}

export type DecodedEvent =
  | { kind: "TRANSFER"; token: Hex; from: Hex; to: Hex; amount: string; uiAmount?: string }
  | { kind: "SWAP"; protocol: "uniswap-v2" | "uniswap-v3" | "uniswap-v4"; pool: Hex; amounts: Record<string, string> }
  | { kind: "LP_ADD" | "LP_REMOVE"; protocol: "uniswap-v2" | "uniswap-v3" | "uniswap-v4"; pool: Hex; details: Record<string, string> }
  | { kind: "LP_NFT_TRANSFER"; contract: Hex; from: Hex; to: Hex; tokenId: string }
  | { kind: "NATIVE_TRANSFER"; from: Hex; to: Hex; amount: string }
  | { kind: "CONTRACT_CALL"; to: Hex; selector: Hex };

export interface NormalizedEvent {
  chainId: number;
  txHash: Hex;
  logIndex: number;
  blockNumber: bigint;
  timestamp: Date;
  wallet: string; // lowercase watched address this event belongs to
  contract: Hex;
  event: DecodedEvent;
}
