// Spot USD prices for native assets (ETH, SOL) from Alchemy's Prices API,
// cached for a minute. Without an ALCHEMY_API_KEY, prices are simply unknown
// and actions are stored without a USD value.

const TTL_MS = 60_000;
const cache = new Map<string, { usd: number | null; at: number }>();

export async function fetchUsdPrices(symbols: string[]): Promise<void> {
  const key = process.env.ALCHEMY_API_KEY;
  const stale = [...new Set(symbols)].filter((s) => !cache.has(s) || Date.now() - cache.get(s)!.at > TTL_MS);
  if (!key || !stale.length) return;
  try {
    const qs = stale.map((s) => `symbols=${encodeURIComponent(s)}`).join("&");
    const res = await fetch(`https://api.g.alchemy.com/prices/v1/${key}/tokens/by-symbol?${qs}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { symbol: string; prices?: { currency: string; value: string }[] }[] };
    for (const d of json.data ?? []) {
      const usd = d.prices?.find((p) => p.currency.toLowerCase() === "usd");
      cache.set(d.symbol, { usd: usd ? Number(usd.value) : null, at: Date.now() });
    }
  } catch (e) {
    console.warn("price lookup failed:", (e as Error).message);
  }
}

/** Synchronous read of the cache, for the pure action builders. Call fetchUsdPrices first. */
export const cachedUsdPrice = (symbol: string): number | null => cache.get(symbol)?.usd ?? null;
