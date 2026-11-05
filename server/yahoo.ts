import type { Candle, CandlesResponse, SearchItem } from '../shared/types';
import { weekStart } from '../shared/week';
import { fetchJson } from './http';

interface YahooChart {
  chart: {
    result:
      | {
          meta: {
            symbol: string;
            currency?: string;
            gmtoffset?: number;
            longName?: string;
            shortName?: string;
          };
          timestamp?: number[];
          indicators: {
            quote: {
              open: (number | null)[];
              high: (number | null)[];
              low: (number | null)[];
              close: (number | null)[];
              volume: (number | null)[];
            }[];
          };
        }[]
      | null;
    error: { code: string; description: string } | null;
  };
}

const HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

/**
 * Yahoo 주봉 응답 정규화.
 * - 시각을 거래소 현지 기준으로 옮긴 뒤 월요일로 내림 (한국 주식은 일요일 15:00 UTC 로 오기 때문)
 * - 마지막 행이 '진행 중인 주'의 중복으로 오는 경우가 있어 같은 주는 병합
 */
export function parseYahooWeekly(json: YahooChart): CandlesResponse {
  const r = json.chart.result?.[0];
  if (!r || json.chart.error) throw new Error(json.chart.error?.description ?? '데이터 없음');
  const q = r.indicators.quote[0];
  const off = r.meta.gmtoffset ?? 0;
  const candles: Candle[] = [];
  (r.timestamp ?? []).forEach((ts, i) => {
    const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
    if (o == null || h == null || l == null || c == null) return;
    const t = weekStart(ts + off);
    const v = q.volume[i] ?? 0;
    const last = candles[candles.length - 1];
    if (last && last.time === t) {
      last.high = Math.max(last.high, h);
      last.low = Math.min(last.low, l);
      last.close = c;
      last.volume = Math.max(last.volume, v);
    } else {
      candles.push({ time: t, open: o, high: h, low: l, close: c, volume: v });
    }
  });
  return {
    symbol: r.meta.symbol,
    name: r.meta.longName ?? r.meta.shortName ?? r.meta.symbol,
    currency: r.meta.currency ?? '',
    candles,
  };
}

export async function yahooWeekly(symbol: string): Promise<CandlesResponse> {
  let lastErr: unknown;
  for (const host of HOSTS) {
    try {
      const json = await fetchJson<YahooChart>(
        `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1wk&range=max&includePrePost=false&events=`,
      );
      return parseYahooWeekly(json);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

interface YahooSearch {
  quotes?: {
    symbol: string;
    shortname?: string;
    longname?: string;
    exchDisp?: string;
    exchange?: string;
    quoteType?: string;
  }[];
}

const ALLOWED_TYPES = new Set(['EQUITY', 'ETF', 'INDEX', 'MUTUALFUND', 'CURRENCY', 'FUTURE']);

export async function yahooSearch(q: string): Promise<SearchItem[]> {
  const json = await fetchJson<YahooSearch>(
    `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&listsCount=0`,
  );
  return (json.quotes ?? [])
    .filter((x) => x.symbol && ALLOWED_TYPES.has(x.quoteType ?? ''))
    .map((x) => ({
      type: 'stock' as const,
      symbol: x.symbol,
      name: x.longname ?? x.shortname ?? x.symbol,
      exchange: x.exchDisp ?? x.exchange ?? '',
    }));
}
