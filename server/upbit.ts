import { weekStartOfDate } from '../shared/week';
import { fetchJson } from './http';

const BASE = 'https://api.upbit.com/v1';

export interface UpbitWeek {
  candle_date_time_utc: string;
  candle_date_time_kst: string;
  first_day_of_period?: string;
  trade_price: number;
}

/** 업비트 주봉 → {월요일 키: 종가(KRW)} */
export function parseUpbitWeeks(rows: UpbitWeek[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of rows) {
    const date = r.first_day_of_period ?? r.candle_date_time_kst.slice(0, 10);
    m.set(weekStartOfDate(date), r.trade_price);
  }
  return m;
}

/** 업비트 KRW 마켓 주봉 종가 (1회 200개 제한 → 페이지네이션) */
export async function upbitWeeklyCloses(base: string, since: number): Promise<Map<number, number>> {
  const all: UpbitWeek[] = [];
  let to: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url = `${BASE}/candles/weeks?market=KRW-${encodeURIComponent(base)}&count=200${to ? `&to=${encodeURIComponent(to)}` : ''}`;
    const rows = await fetchJson<UpbitWeek[]>(url);
    if (!rows.length) break;
    all.push(...rows);
    const oldest = rows[rows.length - 1];
    if (rows.length < 200 || Date.parse(oldest.candle_date_time_utc + 'Z') / 1000 <= since) break;
    to = oldest.candle_date_time_utc + 'Z';
  }
  return parseUpbitWeeks(all);
}

export interface UpbitMarket {
  market: string;
  korean_name: string;
  english_name: string;
}

export async function upbitMarkets(): Promise<UpbitMarket[]> {
  return fetchJson<UpbitMarket[]>(`${BASE}/market/all?isDetails=false`);
}
