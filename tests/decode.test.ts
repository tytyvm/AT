import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, pad, type Hex } from "viem";
import { ABI, decodeLog, decodeTx } from "@/data/decode";
import type { RawLog, TxContext } from "@/data/types";

const WALLET = "0x1111111111111111111111111111111111111111" as Hex;
const OTHER = "0x2222222222222222222222222222222222222222" as Hex;
const TOKEN = "0x3333333333333333333333333333333333333333" as Hex;
const POOL = "0x4444444444444444444444444444444444444444" as Hex;
const ROUTER = "0x5555555555555555555555555555555555555555" as Hex;
const HASH = ("0x" + "ab".repeat(32)) as Hex;

function mkLog(address: Hex, eventName: string, args: Record<string, unknown>, dataTypes: { type: string }[], dataValues: unknown[], logIndex = 0, abiIndex?: number): RawLog {
  const candidates = ABI.filter((x) => x.type === "event" && x.name === eventName);
  const abiItem = candidates[abiIndex ?? 0];
  const topics = encodeEventTopics({ abi: [abiItem], args } as any) as Hex[];
  return { address, topics, data: encodeAbiParameters(dataTypes as any, dataValues as any), logIndex, transactionHash: HASH, blockNumber: 1n };
}
const tx = (logs: RawLog[], from: Hex = WALLET, extra: Partial<TxContext> = {}): TxContext =>
  ({ hash: HASH, from, to: ROUTER, value: 0n, input: "0x", blockNumber: 1n, timestamp: new Date(0), logs, ...extra });

describe("decodeLog", () => {
  it("decodes an ERC-20 transfer", () => {
    const l = mkLog(TOKEN, "Transfer", { from: WALLET, to: OTHER }, [{ type: "uint256" }], [10n ** 18n]);
    expect(decodeLog(l)).toEqual({ kind: "TRANSFER", token: TOKEN, from: WALLET, to: OTHER, amount: "1000000000000000000" });
  });

  it("treats a 4-topic Transfer as an NFT (LP position) transfer", () => {
    const l = mkLog(TOKEN, "Transfer", { from: WALLET, to: OTHER }, [], []);
    l.topics.push(pad("0x2a", { size: 32 }));
    l.data = "0x";
    expect(decodeLog(l)).toMatchObject({ kind: "LP_NFT_TRANSFER", tokenId: "42" });
  });

  it("decodes a Uniswap v2 swap", () => {
    const l = mkLog(POOL, "Swap", { sender: ROUTER, to: WALLET }, [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }], [5n, 0n, 0n, 7n], 0, 0);
    expect(decodeLog(l)).toMatchObject({ kind: "SWAP", protocol: "uniswap-v2", amounts: { amount0In: "5", amount1Out: "7" } });
  });

  it("decodes a Uniswap v3 swap with negative amounts", () => {
    const l = mkLog(POOL, "Swap", { sender: ROUTER, recipient: WALLET },
      [{ type: "int256" }, { type: "int256" }, { type: "uint160" }, { type: "uint128" }, { type: "int24" }], [-100n, 250n, 1n, 1n, -5], 0, 1);
    expect(decodeLog(l)).toMatchObject({ kind: "SWAP", protocol: "uniswap-v3", amounts: { amount0: "-100", amount1: "250", tick: "-5" } });
  });

  it("decodes v4 ModifyLiquidity as add or remove by sign", () => {
    const id = ("0x" + "cd".repeat(32)) as Hex;
    const types = [{ type: "int24" }, { type: "int24" }, { type: "int256" }, { type: "bytes32" }];
    const add = mkLog(POOL, "ModifyLiquidity", { id, sender: ROUTER }, types, [-60, 60, 1000n, id]);
    const rem = mkLog(POOL, "ModifyLiquidity", { id, sender: ROUTER }, types, [-60, 60, -1000n, id]);
    expect(decodeLog(add)).toMatchObject({ kind: "LP_ADD", protocol: "uniswap-v4", pool: id });
    expect(decodeLog(rem)).toMatchObject({ kind: "LP_REMOVE", protocol: "uniswap-v4" });
  });

  it("ignores unrelated logs", () => {
    expect(decodeLog({ address: TOKEN, topics: [("0x" + "00".repeat(32)) as Hex], data: "0x", logIndex: 0, transactionHash: HASH, blockNumber: 1n })).toBeNull();
  });
});

describe("decodeTx attribution", () => {
  const watched = new Set([WALLET.toLowerCase()]);

  it("attributes swaps to the tx sender even though a router called the pool", () => {
    const swap = mkLog(POOL, "Swap", { sender: ROUTER, to: ROUTER }, [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }], [1n, 0n, 0n, 2n], 3, 0);
    const out = decodeTx(tx([swap]), 4663, watched);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ wallet: WALLET.toLowerCase(), logIndex: 3, event: { kind: "SWAP" } });
  });

  it("does not attribute swaps from unwatched senders", () => {
    const swap = mkLog(POOL, "Swap", { sender: ROUTER, to: ROUTER }, [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }], [1n, 0n, 0n, 2n], 0, 0);
    expect(decodeTx(tx([swap], OTHER), 4663, watched)).toHaveLength(0);
  });

  it("merges stock-token TransferWithScaledUI into the Transfer (no double count)", () => {
    const t = mkLog(TOKEN, "Transfer", { from: OTHER, to: WALLET }, [{ type: "uint256" }], [10n], 0);
    const s = mkLog(TOKEN, "TransferWithScaledUI", { from: OTHER, to: WALLET }, [{ type: "uint256" }, { type: "uint256" }], [10n, 11n], 1);
    const out = decodeTx(tx([t, s], OTHER), 4663, watched);
    expect(out).toHaveLength(1);
    expect(out[0].event).toMatchObject({ kind: "TRANSFER", amount: "10", uiAmount: "11" });
  });

  it("emits native ETH transfers and contract calls at tx level", () => {
    const out = decodeTx(tx([], WALLET, { value: 5n, input: "0xa9059cbb0000" }), 4663, watched);
    expect(out.map((e) => e.event.kind).sort()).toEqual(["CONTRACT_CALL", "NATIVE_TRANSFER"]);
    expect(out.find((e) => e.event.kind === "CONTRACT_CALL")!.event).toMatchObject({ selector: "0xa9059cbb" });
  });
});
