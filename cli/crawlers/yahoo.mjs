export async function fetchPrice(config) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.symbol)}?range=1d&interval=1d`;
  try {
    const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (eventide-collector)' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch { return null; }
}
