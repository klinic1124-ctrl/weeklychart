import type { Candle } from '../shared/types';
import { toWeekly } from './aggregate';
import { fetchJson, mapLimit } from './http';

const BASE = 'https://api.exchange.coinbase.com';
const DAY = 86400;
const CHUNK_DAYS = 300;

/** [time, low, high, open, close, volume] */
type CbRow = [number, number, number, number, number, number];

export function parseCoinbaseDaily(rows: CbRow[]): Candle[] {
  return rows.map(([time, low, high, open, close, volume]) => ({ time, open, high, low, close, volume }));
}

/**
 * 코인베이스는 주봉을 제공하지 않으므로(최대 일봉, 1회 300개)
 * since 이후 일봉을 나눠 받아 월요일 기준 주봉으로 집계한 뒤 종가만 반환.
 */
export async function coinbaseWeeklyCloses(base: string, since: number): Promise<Map<number, number>> {
  const product = `${encodeURIComponent(base)}-USD`;
  const now = Math.floor(Date.now() / 1000);
  const ranges: [number, number][] = [];
  for (let s = since; s < now; s += CHUNK_DAYS * DAY) {
    ranges.push([s, Math.min(s + (CHUNK_DAYS - 1) * DAY, now)]);
  }
  const chunks = await mapLimit(ranges, 4, async ([s, e]) => {
    const url = `${BASE}/products/${product}/candles?granularity=86400&start=${new Date(s * 1000).toISOString()}&end=${new Date(e * 1000).toISOString()}`;
    return parseCoinbaseDaily(await fetchJson<CbRow[]>(url));
  });
  const m = new Map<number, number>();
  for (const w of toWeekly(chunks.flat())) m.set(w.time, w.close);
  return m;
}

interface CbProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
  status: string;
  trading_disabled?: boolean;
}

export async function coinbaseUsdBases(): Promise<Set<string>> {
  const rows = await fetchJson<CbProduct[]>(`${BASE}/products`);
  return new Set(
    rows.filter((p) => p.quote_currency === 'USD' && p.status === 'online' && !p.trading_disabled).map((p) => p.base_currency),
  );
}
