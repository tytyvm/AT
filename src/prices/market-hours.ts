// US equity market hours, used to flag stock-token prices as possibly stale.
// Stock-token Chainlink feeds only move while the underlying market trades.

// NYSE full-day closures. Verify each December against nyse.com/markets/hours-calendars.
export const NYSE_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19",
  "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18",
  "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

function nyParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** True during regular session: Mon–Fri 9:30–16:00 New York time, excluding holidays. */
export function isUsMarketOpen(now = new Date()): boolean {
  const { date, weekday, minutes } = nyParts(now);
  if (weekday === "Sat" || weekday === "Sun") return false;
  if (NYSE_HOLIDAYS.has(date)) return false;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

/**
 * A stock-token price is "maybe stale" when the market is closed, or when the
 * feed hasn't updated within maxAgeSec during market hours.
 */
export function isStockPriceStale(updatedAt: Date, now = new Date(), maxAgeSec = 3600): boolean {
  if (!isUsMarketOpen(now)) return true;
  return (now.getTime() - updatedAt.getTime()) / 1000 > maxAgeSec;
}

export const STALE_LABEL = "Price may be stale: US markets are closed";
