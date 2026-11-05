import { toWeekly } from './aggregate';
import type { Candle } from './types';

const DAY = 86400;

export type GetJson = <T>(url: string) => Promise<T>;

/** [time, low, high, open, close, volume] */
export type CbRow = [number, number, number, number, number, number];

export function parseCoinbaseDaily(rows: CbRow[]): Candle[] {
  return rows.map(([time, low, high, open, close, volume]) => ({ time, open, high, low, close, volume }));
}

interface AdvCandles {
  candles?: { start: string; low: string; high: string; open: string; close: string; volume: string }[];
}

export function parseCoinbaseAdvanced(json: AdvCandles): Candle[] {
  return (json.candles ?? []).map((c) => ({
    time: +c.start,
    open: +c.open,
    high: +c.high,
    low: +c.low,
    close: +c.close,
    volume: +c.volume,
  }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const statusOf = (e: unknown) => (e as { status?: number }).status ?? 0;

/** 429(호출 제한)·일시 오류는 잠시 쉬었다 재시도 */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const st = statusOf(e);
      if (i >= tries - 1 || !(st === 429 || st >= 500)) throw e;
      await sleep(700 * (i + 1));
    }
  }
}

/** 기간을 chunkDays 단위로 나눠 순서대로(동시 2개) 받는다 */
async function chunked(
  since: number,
  chunkDays: number,
  fetchChunk: (s: number, e: number) => Promise<Candle[]>,
): Promise<Candle[]> {
  const now = Math.floor(Date.now() / 1000);
  const ranges: [number, number][] = [];
  for (let s = since; s < now; s += chunkDays * DAY) ranges.push([s, Math.min(s + (chunkDays - 1) * DAY, now)]);
  const out: Candle[] = [];
  for (let i = 0; i < ranges.length; i += 2) {
    const part = await Promise.all(ranges.slice(i, i + 2).map(([s, e]) => withRetry(() => fetchChunk(s, e))));
    part.forEach((p) => out.push(...p));
  }
  return out;
}

/**
 * 코인베이스 USD 주봉 종가 (일봉을 받아 월요일 기준으로 집계).
 * 1) Exchange API (1회 300개)  2) 실패 시 Advanced Trade 공개 API (1회 350개)
 * 상장되지 않은 종목(404)은 그대로 오류를 던진다.
 */
export async function coinbaseWeeklyCloses(base: string, since: number, getJson: GetJson): Promise<Map<number, number>> {
  const product = `${encodeURIComponent(base)}-USD`;
  let daily: Candle[];
  try {
    daily = await chunked(since, 300, async (s, e) =>
      parseCoinbaseDaily(
        await getJson<CbRow[]>(
          `https://api.exchange.coinbase.com/products/${product}/candles?granularity=86400&start=${new Date(s * 1000).toISOString()}&end=${new Date(e * 1000).toISOString()}`,
        ),
      ),
    );
  } catch (e) {
    if (statusOf(e) === 404 || statusOf(e) === 400) throw e;
    daily = await chunked(since, 350, async (s, e2) =>
      parseCoinbaseAdvanced(
        await getJson<AdvCandles>(
          `https://api.coinbase.com/api/v3/brokerage/market/products/${product}/candles?start=${s}&end=${e2}&granularity=ONE_DAY&limit=350`,
        ),
      ),
    );
  }
  const m = new Map<number, number>();
  for (const w of toWeekly(daily)) m.set(w.time, w.close);
  return m;
}
