import { describe, expect, it } from "vitest";
import { isStockPriceStale, isUsMarketOpen } from "@/prices/market-hours";

describe("US market hours", () => {
  it("open on a regular weekday midday (Wed Oct 28 2026, 12:00 ET = 16:00 UTC)", () => {
    expect(isUsMarketOpen(new Date("2026-10-28T16:00:00Z"))).toBe(true);
  });
  it("closed before 9:30 ET", () => {
    expect(isUsMarketOpen(new Date("2026-10-28T13:29:00Z"))).toBe(false);
  });
  it("closed on weekends", () => {
    expect(isUsMarketOpen(new Date("2026-10-31T16:00:00Z"))).toBe(false);
  });
  it("closed on Thanksgiving", () => {
    expect(isUsMarketOpen(new Date("2026-11-26T17:00:00Z"))).toBe(false);
  });
  it("flags prices stale when the market is closed, even if just updated", () => {
    const sat = new Date("2026-10-31T16:00:00Z");
    expect(isStockPriceStale(sat, sat)).toBe(true);
  });
  it("fresh during market hours, stale if the feed is an hour old", () => {
    const now = new Date("2026-10-28T16:00:00Z");
    expect(isStockPriceStale(new Date(now.getTime() - 60_000), now)).toBe(false);
    expect(isStockPriceStale(new Date(now.getTime() - 2 * 3600_000), now)).toBe(true);
  });
});
