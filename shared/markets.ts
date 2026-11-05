import type { BinanceMiniTicker } from './binance';
import type { CryptoExchanges, CryptoMarket } from './types';

/** 바이낸스 USDT 마켓 목록 + 업비트 한글명 / 코인베이스 상장 여부 결합 (거래대금순) */
export function buildMarkets(tickers: BinanceMiniTicker[], ex: CryptoExchanges): CryptoMarket[] {
  const kr = new Map(ex.upbit.map((u) => [u.base, u]));
  const cb = new Set(ex.coinbase);
  const out: CryptoMarket[] = [];
  for (const t of tickers) {
    if (!t.symbol.endsWith('USDT')) continue;
    const qv = +t.quoteVolume;
    if (!qv) continue;
    const base = t.symbol.slice(0, -4);
    const k = kr.get(base);
    out.push({
      base,
      name: k?.en ?? base,
      ...(k ? { koreanName: k.ko } : {}),
      lastPrice: +t.lastPrice,
      quoteVolume: qv,
      upbit: !!k,
      coinbase: cb.has(base),
    });
  }
  return out.sort((a, b) => b.quoteVolume - a.quoteVolume);
}
