import { describe, expect, it } from "vitest";
import { MAX_LABEL_LENGTH, parseWalletInput } from "../src/lib/watchlist";

const ADDR = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const SOL = "haqq6qnVBCZt97amh9VUFZRFCkD6NJxoYifacCuqqqq";

describe("parseWalletInput", () => {
  it("detects Robinhood Chain, lowercases the address and keeps the label", () => {
    expect(parseWalletInput(` ${ADDR} `, "  whale   #1 ")).toEqual({ ok: true, chainId: 4663, address: ADDR.toLowerCase(), label: "whale #1" });
  });
  it("detects Solana and keeps the address's exact case", () => {
    expect(parseWalletInput(SOL, "bot")).toEqual({ ok: true, chainId: 101, address: SOL, label: "bot" });
  });
  it("falls back to a short address when there's no label", () => {
    const r = parseWalletInput(ADDR, "");
    expect(r.ok && r.label).toBe("0x0Bd7…AD73");
    const s = parseWalletInput(SOL, "");
    expect(s.ok && s.label).toBe("haqq…qqqq");
  });
  it("accepts all-lowercase EVM addresses", () => {
    expect(parseWalletInput(ADDR.toLowerCase(), "x").ok).toBe(true);
  });
  it("rejects empty, malformed and non-wallet addresses", () => {
    expect(parseWalletInput("", "x").ok).toBe(false);
    expect(parseWalletInput("0x1234", "x").ok).toBe(false);
    expect(parseWalletInput("hello", "x").ok).toBe(false);
    expect(parseWalletInput("0x" + "0".repeat(40), "x").ok).toBe(false);
    expect(parseWalletInput("11111111111111111111111111111111", "x").ok).toBe(false);
  });
  it("never changes a Solana address's case: base58 has no checksum, so another case is another wallet", () => {
    const r = parseWalletInput(SOL.toLowerCase(), "x");
    if (r.ok) expect(r.address).not.toBe(SOL);
  });
  it("rejects labels that are too long", () => {
    expect(parseWalletInput(ADDR, "a".repeat(MAX_LABEL_LENGTH + 1)).ok).toBe(false);
  });
});
