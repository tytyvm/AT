import { decodeEventLog, parseAbi, toEventSelector } from "viem";
import type { DecodedEvent, Hex, NormalizedEvent, RawLog, TxContext } from "./types";

// Events are matched by signature, not by contract address, so any
// Uniswap-compatible fork on any EVM chain decodes the same way.
export const ABI = parseAbi([
  // ERC-20 / ERC-721 share this signature; ERC-721 has 4 topics (tokenId indexed)
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  // ERC-8056 (Robinhood stock tokens): carries the underlying-share amount
  "event TransferWithScaledUI(address indexed from, address indexed to, uint256 value, uint256 uiValue)",
  // Uniswap v2
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
  "event Mint(address indexed sender, uint256 amount0, uint256 amount1)",
  "event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)",
  // Uniswap v3 pool
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
  "event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
  "event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
  // Uniswap v4 PoolManager (singleton)
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
  "event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)",
]);

const sig = (s: string) => toEventSelector(s);
export const TOPIC = {
  TRANSFER: sig("Transfer(address,address,uint256)"),
  SCALED_UI: sig("TransferWithScaledUI(address,address,uint256,uint256)"),
  V2_SWAP: sig("Swap(address,uint256,uint256,uint256,uint256,address)"),
  V2_MINT: sig("Mint(address,uint256,uint256)"),
  V2_BURN: sig("Burn(address,uint256,uint256,address)"),
  V3_SWAP: sig("Swap(address,address,int256,int256,uint160,uint128,int24)"),
  V3_MINT: sig("Mint(address,address,int24,int24,uint128,uint256,uint256)"),
  V3_BURN: sig("Burn(address,int24,int24,uint128,uint256,uint256)"),
  V4_SWAP: sig("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)"),
  V4_MODIFY: sig("ModifyLiquidity(bytes32,address,int24,int24,int256,bytes32)"),
} as const;

const s = (v: unknown) => (typeof v === "bigint" ? v.toString() : String(v));
const lc = (a: string) => a.toLowerCase() as Hex;

type Internal = DecodedEvent | { kind: "SCALED_UI"; token: Hex; from: Hex; to: Hex; amount: string; uiAmount: string };

/** Decode a single log. Returns null for logs we don't care about. */
export function decodeLog(log: RawLog): Internal | null {
  const t0 = log.topics[0];
  // ERC-721 Transfer (LP position NFTs): same topic0 as ERC-20 but tokenId is
  // indexed, so 4 topics and empty data. The ERC-20 ABI can't decode it.
  if (t0 === TOPIC.TRANSFER && log.topics.length === 4) {
    const addr = (t: Hex) => lc(`0x${t.slice(26)}`);
    return { kind: "LP_NFT_TRANSFER", contract: lc(log.address), from: addr(log.topics[1]), to: addr(log.topics[2]), tokenId: BigInt(log.topics[3]).toString() };
  }
  try {
    const d = decodeEventLog({ abi: ABI, topics: log.topics as [Hex, ...Hex[]], data: log.data, strict: true });
    const a = d.args as Record<string, unknown>;
    switch (t0) {
      case TOPIC.TRANSFER:
        return { kind: "TRANSFER", token: lc(log.address), from: lc(a.from as string), to: lc(a.to as string), amount: s(a.value) };
      case TOPIC.SCALED_UI:
        return { kind: "SCALED_UI", token: lc(log.address), from: lc(a.from as string), to: lc(a.to as string), amount: s(a.value), uiAmount: s(a.uiValue) };
      case TOPIC.V2_SWAP:
        return { kind: "SWAP", protocol: "uniswap-v2", pool: lc(log.address), amounts: { amount0In: s(a.amount0In), amount1In: s(a.amount1In), amount0Out: s(a.amount0Out), amount1Out: s(a.amount1Out) } };
      case TOPIC.V3_SWAP:
        return { kind: "SWAP", protocol: "uniswap-v3", pool: lc(log.address), amounts: { amount0: s(a.amount0), amount1: s(a.amount1), tick: s(a.tick) } };
      case TOPIC.V4_SWAP:
        return { kind: "SWAP", protocol: "uniswap-v4", pool: a.id as Hex, amounts: { amount0: s(a.amount0), amount1: s(a.amount1), tick: s(a.tick), fee: s(a.fee) } };
      case TOPIC.V2_MINT:
        return { kind: "LP_ADD", protocol: "uniswap-v2", pool: lc(log.address), details: { amount0: s(a.amount0), amount1: s(a.amount1) } };
      case TOPIC.V2_BURN:
        return { kind: "LP_REMOVE", protocol: "uniswap-v2", pool: lc(log.address), details: { amount0: s(a.amount0), amount1: s(a.amount1) } };
      case TOPIC.V3_MINT:
        return { kind: "LP_ADD", protocol: "uniswap-v3", pool: lc(log.address), details: { tickLower: s(a.tickLower), tickUpper: s(a.tickUpper), liquidity: s(a.amount), amount0: s(a.amount0), amount1: s(a.amount1) } };
      case TOPIC.V3_BURN:
        return { kind: "LP_REMOVE", protocol: "uniswap-v3", pool: lc(log.address), details: { tickLower: s(a.tickLower), tickUpper: s(a.tickUpper), liquidity: s(a.amount), amount0: s(a.amount0), amount1: s(a.amount1) } };
      case TOPIC.V4_MODIFY: {
        const delta = a.liquidityDelta as bigint;
        return { kind: delta >= 0n ? "LP_ADD" : "LP_REMOVE", protocol: "uniswap-v4", pool: a.id as Hex, details: { tickLower: s(a.tickLower), tickUpper: s(a.tickUpper), liquidityDelta: s(delta) } };
      }
    }
  } catch {
    // Same topic0 but different shape (e.g. a non-standard token). Skip safely.
  }
  return null;
}

/**
 * Decode every log in a transaction and attribute events to watched wallets.
 * - Transfers / NFT moves belong to the wallets on either side.
 * - Swaps and LP changes belong to the tx sender (routers sit in between).
 * - Stock-token TransferWithScaledUI is merged into its Transfer (uiAmount),
 *   so a stock transfer is never counted twice.
 */
export function decodeTx(tx: TxContext, chainId: number, watched: Set<string>): NormalizedEvent[] {
  const decoded = tx.logs.map((l) => ({ log: l, ev: decodeLog(l) })).filter((x) => x.ev);

  const scaled = new Map<string, string>(); // token|from|to|amount -> uiAmount
  for (const { ev } of decoded) {
    if (ev!.kind === "SCALED_UI") scaled.set(`${ev!.token}|${ev!.from}|${ev!.to}|${ev!.amount}`, ev!.uiAmount);
  }

  const out: NormalizedEvent[] = [];
  const sender = tx.from.toLowerCase();
  const base = { chainId, txHash: tx.hash, blockNumber: tx.blockNumber, timestamp: tx.timestamp };

  // Tx-level events use logIndex -1 (native ETH) and -2 (contract call).
  if (tx.value > 0n && tx.to) {
    const from = lc(tx.from), to = lc(tx.to);
    const ev: DecodedEvent = { kind: "NATIVE_TRANSFER", from, to, amount: tx.value.toString() };
    for (const w of new Set([from, to])) if (watched.has(w)) out.push({ ...base, logIndex: -1, wallet: w, contract: to, event: ev });
  }
  if (watched.has(sender) && tx.to && tx.input && tx.input.length >= 10) {
    out.push({ ...base, logIndex: -2, wallet: sender, contract: lc(tx.to), event: { kind: "CONTRACT_CALL", to: lc(tx.to), selector: tx.input.slice(0, 10) as Hex } });
  }

  for (const { log, ev } of decoded) {
    if (!ev || ev.kind === "SCALED_UI") continue;
    let event: DecodedEvent = ev;
    if (ev.kind === "TRANSFER") {
      const ui = scaled.get(`${ev.token}|${ev.from}|${ev.to}|${ev.amount}`);
      if (ui) event = { ...ev, uiAmount: ui };
    }
    const owners = new Set<string>();
    if (event.kind === "TRANSFER" || event.kind === "LP_NFT_TRANSFER") {
      if (watched.has(event.from)) owners.add(event.from);
      if (watched.has(event.to)) owners.add(event.to);
    } else if (watched.has(sender)) {
      owners.add(sender);
    }
    for (const wallet of owners) {
      out.push({ chainId, txHash: tx.hash, logIndex: log.logIndex, blockNumber: tx.blockNumber, timestamp: tx.timestamp, wallet, contract: lc(log.address), event });
    }
  }
  return out;
}
