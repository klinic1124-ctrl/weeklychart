import {
  binanceGet,
  miniTickersPath,
  NotListed,
  parseKlines,
  weeklyKlinesPath,
  type BinanceMiniTicker,
  type Kline,
} from '../../shared/binance';
import { buildMarkets } from '../../shared/markets';
import { coinbasePremium, upbitPremium } from '../../shared/premium';
import type {
  AssetType,
  Candle,
  CandlesResponse,
  CryptoExchanges,
  CryptoMarket,
  PremiumResponse,
  PremiumSources,
  SearchItem,
} from '../../shared/types';

const memo = new Map<string, { at: number; p: Promise<unknown> }>();
const TTL = 5 * 60 * 1000;

/** 같은 키의 요청은 TTL 동안 재사용 (실패 시 즉시 폐기) */
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.p as Promise<T>;
  const p = fn();
  memo.set(key, { at: Date.now(), p });
  p.catch(() => memo.delete(key));
  return p;
}

class FetchError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new FetchError(res.status, (body as { error?: string; msg?: string } | null)?.error ?? `HTTP ${res.status}`);
  return body as T;
}

/** 바이낸스는 클라우드 서버 IP를 차단하므로 브라우저에서 직접 호출, 실패 시 서버 경유 */
async function binanceDirect<T>(path: string): Promise<T> {
  return binanceGet(path, (u) => getJson<T>(u));
}

async function cryptoCandles(base: string): Promise<CandlesResponse> {
  let candles: Candle[];
  try {
    candles = parseKlines(await binanceDirect<Kline[]>(weeklyKlinesPath(base)));
  } catch (e) {
    if (e instanceof NotListed) throw e;
    return getJson<CandlesResponse>(`/api/crypto/candles?base=${encodeURIComponent(base)}`);
  }
  return { symbol: `${base}USDT`, name: base, currency: 'USDT', candles };
}

async function premium(base: string): Promise<PremiumResponse> {
  const { candles } = await api.candles('crypto', base);
  if (!candles.length) return { base, upbit: [], coinbase: [] };
  const src = await getJson<PremiumSources>(
    `/api/crypto/premium?base=${encodeURIComponent(base)}&since=${candles[0].time}`,
  );
  return {
    base,
    upbit: upbitPremium(candles, new Map(src.upbit), new Map(src.usdkrw)),
    coinbase: coinbasePremium(candles, new Map(src.coinbase)),
    ...(src.warnings ? { warnings: src.warnings } : {}),
  };
}

async function cryptoMarkets(): Promise<CryptoMarket[]> {
  const [tickers, ex] = await Promise.all([
    binanceDirect<BinanceMiniTicker[]>(miniTickersPath).catch(() => null),
    getJson<CryptoExchanges>('/api/crypto/exchanges').catch(() => ({ upbit: [], coinbase: [] }) as CryptoExchanges),
  ]);
  const list = tickers ?? ex.binance;
  if (!list) throw new Error('바이낸스 종목 목록을 불러오지 못했습니다');
  return buildMarkets(list, ex);
}

export const api = {
  candles: (type: AssetType, symbol: string) =>
    once(`candles:${type}:${symbol}`, () =>
      type === 'crypto'
        ? cryptoCandles(symbol)
        : getJson<CandlesResponse>(`/api/stock/candles?symbol=${encodeURIComponent(symbol)}`),
    ),
  premium: (base: string) => once(`premium:${base}`, () => premium(base)),
  cryptoMarkets: () => once('markets', cryptoMarkets),
  searchStocks: (q: string) =>
    once(`search:${q}`, () => getJson<SearchItem[]>(`/api/stock/search?q=${encodeURIComponent(q)}`)),
};
