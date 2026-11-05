import type { CandlesResponse, CryptoMarket, PremiumResponse, SearchItem } from '../shared/types';
import { binanceTickers, binanceWeekly } from './binance';
import { coinbaseUsdBases, coinbaseWeeklyCloses } from './coinbase';
import { HttpError } from './http';
import { naverSearch, naverWeekly, parseKoreanSymbol } from './naver';
import { coinbasePremium, upbitPremium } from './premium';
import { cachedHandler, type Ctx, requireParam } from './respond';
import { upbitMarkets, upbitWeeklyCloses } from './upbit';
import { yahooSearch, yahooWeekly } from './yahoo';

const STOCK_RE = /^[A-Za-z0-9.\-^=]{1,20}$/;
const BASE_RE = /^[A-Za-z0-9]{1,15}$/;

export const stockCandles = (ctx: Ctx) =>
  cachedHandler<CandlesResponse>(ctx, async (url) => {
    let symbol = requireParam(url, 'symbol', STOCK_RE).toUpperCase();
    if (/^\d{6}$/.test(symbol)) symbol += '.KS';
    try {
      return { data: await yahooWeekly(symbol), ttl: 600 };
    } catch (e) {
      // 한국 주식은 네이버로 재시도
      if (parseKoreanSymbol(symbol)) return { data: await naverWeekly(symbol), ttl: 600 };
      throw e;
    }
  });

export const stockSearch = (ctx: Ctx) =>
  cachedHandler<SearchItem[]>(ctx, async (url) => {
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 40);
    if (!q) return { data: [], ttl: 0 };
    const hangul = /[가-힣]/.test(q);
    const [kr, yh] = await Promise.allSettled([
      naverSearch(q),
      hangul ? Promise.resolve([] as SearchItem[]) : yahooSearch(q),
    ]);
    const seen = new Set<string>();
    const out: SearchItem[] = [];
    for (const r of [kr, yh]) {
      if (r.status !== 'fulfilled') continue;
      for (const it of r.value) {
        if (seen.has(it.symbol)) continue;
        seen.add(it.symbol);
        out.push(it);
      }
    }
    if (kr.status === 'rejected' && yh.status === 'rejected') throw kr.reason;
    return { data: out.slice(0, 25), ttl: 3600 };
  });

export const cryptoCandles = (ctx: Ctx) =>
  cachedHandler<CandlesResponse>(ctx, async (url) => {
    const base = requireParam(url, 'base', BASE_RE).toUpperCase();
    const candles = await binanceWeekly(base);
    return { data: { symbol: `${base}USDT`, name: base, currency: 'USDT', candles }, ttl: 300 };
  });

/** 상장되지 않은 마켓(404/400)은 빈 결과로, 그 외 오류는 경고로 처리 */
async function soft<T>(label: string, p: Promise<T>, empty: T, warnings: string[]): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (!(e instanceof HttpError && (e.status === 404 || e.status === 400))) {
      warnings.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
    return empty;
  }
}

export const cryptoPremium = (ctx: Ctx) =>
  cachedHandler<PremiumResponse>(ctx, async (url) => {
    const base = requireParam(url, 'base', BASE_RE).toUpperCase();
    const binance = await binanceWeekly(base);
    if (!binance.length) return { data: { base, upbit: [], coinbase: [] }, ttl: 1800 };
    const since = binance[0].time;
    const warnings: string[] = [];
    const empty = new Map<number, number>();
    const [up, fx, cb] = await Promise.all([
      soft('업비트', upbitWeeklyCloses(base, since), empty, warnings),
      soft(
        '환율',
        yahooWeekly('KRW=X').then((r) => new Map(r.candles.map((c) => [c.time, c.close]))),
        empty,
        warnings,
      ),
      soft('코인베이스', coinbaseWeeklyCloses(base, since), empty, warnings),
    ]);
    const data: PremiumResponse = {
      base,
      upbit: upbitPremium(binance, up, fx),
      coinbase: coinbasePremium(binance, cb),
      ...(warnings.length ? { warnings } : {}),
    };
    return { data, ttl: warnings.length ? 120 : 1800 };
  });

export const cryptoMarkets = (ctx: Ctx) =>
  cachedHandler<CryptoMarket[]>(ctx, async () => {
    const [tickers, upbit, cb] = await Promise.all([
      binanceTickers(),
      upbitMarkets().catch(() => []),
      coinbaseUsdBases().catch(() => new Set<string>()),
    ]);
    const krNames = new Map<string, { ko: string; en: string }>();
    for (const m of upbit) {
      if (m.market.startsWith('KRW-')) krNames.set(m.market.slice(4), { ko: m.korean_name, en: m.english_name });
    }
    const out: CryptoMarket[] = [];
    for (const t of tickers) {
      if (!t.symbol.endsWith('USDT')) continue;
      const qv = +t.quoteVolume;
      if (!qv) continue;
      const base = t.symbol.slice(0, -4);
      const kr = krNames.get(base);
      out.push({
        base,
        name: kr?.en ?? base,
        ...(kr ? { koreanName: kr.ko } : {}),
        lastPrice: +t.lastPrice,
        quoteVolume: qv,
        upbit: !!kr,
        coinbase: cb.has(base),
      });
    }
    out.sort((a, b) => b.quoteVolume - a.quoteVolume);
    return { data: out, ttl: 3600 };
  });
