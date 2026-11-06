import { describe, expect, it } from "vitest";
import { base58Decode, detectChain, isSolanaAddress, normalizeAddress, shortAddress } from "../src/lib/address";
import { robinhoodMainnet } from "../src/chains/robinhood";
import { solanaMainnet } from "../src/chains/solana";

const SOL_ADDR = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC mint
const SYSTEM = "11111111111111111111111111111111"; // System program: 32 zero bytes
const EVM_ADDR = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

describe("base58", () => {
  it("decodes known 32-byte keys", () => {
    expect(base58Decode(SOL_ADDR)?.length).toBe(32);
    const zero = base58Decode(SYSTEM)!;
    expect(zero.length).toBe(32);
    expect([...zero].every((b) => b === 0)).toBe(true);
  });
  it("rejects characters outside the alphabet", () => {
    expect(base58Decode("0OIl")).toBeNull();
  });
});

describe("addresses", () => {
  it("validates Solana addresses", () => {
    expect(isSolanaAddress(SOL_ADDR)).toBe(true);
    expect(isSolanaAddress(SYSTEM)).toBe(true);
    expect(isSolanaAddress(SOL_ADDR.slice(0, -2))).toBe(false); // wrong length decodes to != 32 bytes
    expect(isSolanaAddress(EVM_ADDR)).toBe(false);
    expect(isSolanaAddress("hello")).toBe(false);
  });
  it("detects the chain from the format", () => {
    expect(detectChain(EVM_ADDR)?.key).toBe("robinhood");
    expect(detectChain(SOL_ADDR)?.key).toBe("solana");
    expect(detectChain("0x1234")).toBeNull();
    expect(detectChain("not an address")).toBeNull();
  });
  it("lowercases EVM addresses but keeps Solana case", () => {
    expect(normalizeAddress(robinhoodMainnet, EVM_ADDR)).toBe(EVM_ADDR.toLowerCase());
    expect(normalizeAddress(solanaMainnet, SOL_ADDR)).toBe(SOL_ADDR);
  });
  it("shortens both formats", () => {
    expect(shortAddress(EVM_ADDR)).toBe("0x0Bd7…AD73");
    expect(shortAddress(SOL_ADDR)).toBe("EPjF…Dt1v");
  });
});
