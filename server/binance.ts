import type { Candle } from '../shared/types';
import { fetchJson } from './http';

// 미국 리전 IP 차단(HTTP 451)을 피하기 위해 시세 전용 미러 도메인 사용
const BASE = 'https://data-api.binance.vision';

type Kline = [number, string, string, string, string, string, ...unknown[]];

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

/** 바이낸스 주봉 (월요일 00:00 UTC 시작). 1000주(약 19년)면 전체 이력 커버 */
export async function binanceWeekly(base: string): Promise<Candle[]> {
  const rows = await fetchJson<Kline[]>(
    `${BASE}/api/v3/klines?symbol=${encodeURIComponent(base)}USDT&interval=1w&limit=1000`,
  );
  return parseKlines(rows);
}

export interface BinanceMiniTicker {
  symbol: string;
  lastPrice: string;
  quoteVolume: string;
}

export async function binanceTickers(): Promise<BinanceMiniTicker[]> {
  return fetchJson<BinanceMiniTicker[]>(`${BASE}/api/v3/ticker/24hr?type=MINI`);
}
