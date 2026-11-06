import { describe, expect, it } from "vitest";
import { MAX_LABEL_LENGTH, parseWalletInput } from "../src/lib/watchlist";

const ADDR = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

describe("parseWalletInput", () => {
  it("lowercases the address and keeps the label", () => {
    expect(parseWalletInput(` ${ADDR} `, "  whale   #1 ")).toEqual({ ok: true, address: ADDR.toLowerCase(), label: "whale #1" });
  });
  it("falls back to a short address when there's no label", () => {
    const r = parseWalletInput(ADDR, "");
    expect(r.ok && r.label).toBe("0x0Bd7…AD73");
  });
  it("accepts all-lowercase addresses", () => {
    expect(parseWalletInput(ADDR.toLowerCase(), "x").ok).toBe(true);
  });
  it("rejects empty, malformed and zero addresses", () => {
    expect(parseWalletInput("", "x").ok).toBe(false);
    expect(parseWalletInput("0x1234", "x").ok).toBe(false);
    expect(parseWalletInput("hello", "x").ok).toBe(false);
    expect(parseWalletInput("0x" + "0".repeat(40), "x").ok).toBe(false);
  });
  it("rejects labels that are too long", () => {
    expect(parseWalletInput(ADDR, "a".repeat(MAX_LABEL_LENGTH + 1)).ok).toBe(false);
  });
});
