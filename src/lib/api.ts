import {
  BINANCE_HOSTS,
  binanceGet,
  miniTickersPath,
  NotListed,
  parseKlines,
  weeklyKlinesPath,
  type BinanceMiniTicker,
  type Kline,
} from '../../shared/binance';
import { coinbaseWeeklyCloses } from '../../shared/coinbase';
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

async function getJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    throw new Error(`${new URL(url, location.href).host}: ${ctrl.signal.aborted ? '시간 초과' : (e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const b = body as { error?: string; msg?: string } | null;
    throw new FetchError(res.status, b?.error ?? `${new URL(url, location.href).host}: HTTP ${res.status}${b?.msg ? ' ' + b.msg : ''}`);
  }
  return body as T;
}

/** 바이낸스는 클라우드 서버 IP를 차단하므로 브라우저에서 직접 호출, 실패 시 서버 경유 */
async function binanceDirect<T>(path: string): Promise<T> {
  return binanceGet(path, (u) => getJson<T>(u, 5000), BINANCE_HOSTS.slice(0, 2));
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
  let cb = new Map(src.coinbase);
  let warnings = src.warnings ?? [];
  // 서버(Cloudflare)에서 코인베이스 조회가 실패했으면 휴대폰에서 직접 시도
  if (!cb.size && warnings.some((w) => w.startsWith('코인베이스'))) {
    try {
      cb = await coinbaseWeeklyCloses(base, candles[0].time, <T>(u: string) => getJson<T>(u, 10000));
      warnings = warnings.filter((w) => !w.startsWith('코인베이스'));
    } catch (e) {
      warnings = [...warnings, `코인베이스(직접): ${(e as Error).message}`];
    }
  }
  return {
    base,
    upbit: upbitPremium(candles, new Map(src.upbit), new Map(src.usdkrw)),
    coinbase: coinbasePremium(candles, cb),
    ...(warnings.length ? { warnings } : {}),
  };
}

export interface MarketsResult {
  markets: CryptoMarket[];
  /** 바이낸스 목록을 못 받아 업비트/코인베이스 목록으로 대체한 경우 그 사유 */
  fallbackReason?: string;
}

async function cryptoMarkets(): Promise<MarketsResult> {
  const ex = getJson<CryptoExchanges>('/api/crypto/exchanges').catch(
    () => ({ upbit: [], coinbase: [] }) as CryptoExchanges,
  );
  let reason = '';
  let tickers: BinanceMiniTicker[] | null = null;
  try {
    tickers = await binanceDirect<BinanceMiniTicker[]>(miniTickersPath);
  } catch (e) {
    reason = e instanceof Error ? e.message : String(e);
  }
  const exchanges = await ex;
  const list = tickers ?? exchanges.binance;
  if (list) return { markets: buildMarkets(list, exchanges) };

  // 바이낸스에 전혀 접속하지 못한 경우: 업비트/코인베이스 목록으로라도 검색 가능하게
  const bases = new Set([...exchanges.upbit.map((u) => u.base), ...exchanges.coinbase]);
  const fake = [...bases].map((b) => ({ symbol: b + 'USDT', lastPrice: '0', quoteVolume: '1' }));
  if (!fake.length) throw new Error(`코인 목록을 불러오지 못했습니다 (바이낸스: ${reason || '응답 없음'})`);
  return { markets: buildMarkets(fake, exchanges), fallbackReason: reason || '응답 없음' };
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
