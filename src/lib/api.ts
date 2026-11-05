import type { CandlesResponse, CryptoMarket, PremiumResponse, SearchItem, AssetType } from '../../shared/types';

const memo = new Map<string, { at: number; p: Promise<unknown> }>();
const TTL = 5 * 60 * 1000;

async function get<T>(path: string): Promise<T> {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.at < TTL) return hit.p as Promise<T>;
  const p = (async () => {
    const res = await fetch(path);
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
    return body as T;
  })();
  memo.set(path, { at: Date.now(), p });
  p.catch(() => memo.delete(path));
  return p;
}

export const api = {
  candles: (type: AssetType, symbol: string) =>
    get<CandlesResponse>(
      type === 'crypto'
        ? `/api/crypto/candles?base=${encodeURIComponent(symbol)}`
        : `/api/stock/candles?symbol=${encodeURIComponent(symbol)}`,
    ),
  premium: (base: string) => get<PremiumResponse>(`/api/crypto/premium?base=${encodeURIComponent(base)}`),
  cryptoMarkets: () => get<CryptoMarket[]>('/api/crypto/markets'),
  searchStocks: (q: string) => get<SearchItem[]>(`/api/stock/search?q=${encodeURIComponent(q)}`),
};
