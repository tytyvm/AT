import { describe, expect, it } from "vitest";
import { compactAmount, describeAction, usd } from "../src/lib/format";

const sol = (delta: string) => ({ asset: "native", symbol: "SOL", decimals: 9, delta });
const tok = (delta: string) => ({ asset: "4aJX6LpSjYm3wWPUDZqgqHqSxZj3r3Ltmjxy4geK55wP", symbol: null, decimals: 6, delta });

describe("format", () => {
  it("compacts amounts", () => {
    expect(compactAmount(318784.467605)).toBe("318.8K");
    expect(compactAmount(13030072.6692)).toBe("13.03M");
    expect(compactAmount(0.0100018)).toBe("0.01");
    expect(compactAmount(0.000014346)).toBe("0.0000143");
    expect(compactAmount(42.5)).toBe("42.5");
  });
  it("describes trades in plain words, using a short mint when there's no symbol", () => {
    expect(describeAction("BUY", [sol("-10001836"), tok("318784467605")])).toBe("Bought 318.8K 4aJX…55wP for 0.01 SOL");
    expect(describeAction("SELL", [tok("-318784467605"), sol("14477616")])).toBe("Sold 318.8K 4aJX…55wP for 0.0145 SOL");
    expect(describeAction("SEND", [sol("-12354560")])).toBe("Sent 0.0124 SOL");
  });
  it("formats USD", () => {
    expect(usd(1.5)).toBe("$1.50");
    expect(usd(12500)).toBe("$12.5K");
    expect(usd(null)).toBe("");
  });
});
