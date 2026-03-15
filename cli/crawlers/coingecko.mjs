export async function fetchPrice(config) {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${config.id}&vs_currencies=usd`;
    const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data[config.id]?.usd ?? null;
  } catch { return null; }
}
