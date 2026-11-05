import { binanceGet, miniTickersPath, parseKlines, weeklyKlinesPath, type BinanceMiniTicker, type Kline } from '../shared/binance';
import type { Candle } from '../shared/types';
import { fetchJson } from './http';

/** 서버(Cloudflare)에서의 바이낸스 호출 – 차단될 수 있어 클라이언트 직접 호출의 대체 경로로만 사용 */
export async function binanceWeekly(base: string): Promise<Candle[]> {
  return parseKlines(await binanceGet(weeklyKlinesPath(base), (u) => fetchJson<Kline[]>(u)));
}

export async function binanceTickers(): Promise<BinanceMiniTicker[]> {
  return binanceGet(miniTickersPath, (u) => fetchJson<BinanceMiniTicker[]>(u));
}
