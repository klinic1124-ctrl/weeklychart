import type { Candle } from './types';

/**
 * 바이낸스 시세 API 호스트 후보.
 * 바이낸스는 일부 클라우드(Cloudflare Workers 등) IP를 403/451 로 차단하므로
 * 브라우저(휴대폰)에서 직접 호출하는 것을 우선하고, 여러 호스트를 순서대로 시도한다.
 */
export const BINANCE_HOSTS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api-gcp.binance.com',
  'https://api1.binance.com',
  'https://api3.binance.com',
];

export type Kline = [number, string, string, string, string, string, ...unknown[]];

export interface BinanceMiniTicker {
  symbol: string;
  lastPrice: string;
  quoteVolume: string;
}

export function parseKlines(rows: Kline[]): Candle[] {
  return rows.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: +k[1],
    high: +k[2],
    low: +k[3],
    close: +k[4],
    volume: +k[5],
  }));
}

export class NotListed extends Error {}

/** 호스트를 순서대로 시도. 400(심볼 없음)은 즉시 NotListed 로 중단 */
export async function binanceGet<T>(
  path: string,
  getJson: (url: string) => Promise<T>,
  hosts: string[] = BINANCE_HOSTS,
): Promise<T> {
  let lastErr: unknown;
  for (const host of hosts) {
    try {
      return await getJson(host + path);
    } catch (e) {
      if ((e as { status?: number }).status === 400) throw new NotListed('바이낸스 USDT 마켓에 없는 종목입니다');
      lastErr = e;
    }
  }
  throw lastErr;
}

export const weeklyKlinesPath = (base: string) =>
  `/api/v3/klines?symbol=${encodeURIComponent(base)}USDT&interval=1w&limit=1000`;

export const miniTickersPath = '/api/v3/ticker/24hr?type=MINI';
