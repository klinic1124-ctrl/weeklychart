import type { Candle, Point } from '../shared/types';

/** 주 키 기준으로 값을 정렬하고, 빈 주는 직전 값으로 채운 조회 함수를 만든다 (환율용) */
export function forwardFill(m: Map<number, number>): (t: number) => number | undefined {
  const keys = [...m.keys()].sort((a, b) => a - b);
  return (t) => {
    if (m.has(t)) return m.get(t);
    let lo = 0, hi = keys.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (keys[mid] <= t) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    // 4주 이상 공백이면 사용하지 않음
    if (ans < 0 || t - keys[ans] > 28 * 86400) return undefined;
    return m.get(keys[ans]);
  };
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** 업비트 프리미엄(%) = 업비트 KRW 종가 / (바이낸스 USDT 종가 × USD/KRW) − 1 */
export function upbitPremium(binance: Candle[], upbitKrw: Map<number, number>, usdKrw: Map<number, number>): Point[] {
  const fx = forwardFill(usdKrw);
  const out: Point[] = [];
  for (const c of binance) {
    const u = upbitKrw.get(c.time);
    const r = fx(c.time);
    if (u == null || r == null || !c.close) continue;
    out.push({ time: c.time, value: round((u / (c.close * r) - 1) * 100) });
  }
  return out;
}

/** 코인베이스 프리미엄(%) = 코인베이스 USD 종가 / 바이낸스 USDT 종가 − 1 */
export function coinbasePremium(binance: Candle[], coinbaseUsd: Map<number, number>): Point[] {
  const out: Point[] = [];
  for (const c of binance) {
    const v = coinbaseUsd.get(c.time);
    if (v == null || !c.close) continue;
    out.push({ time: c.time, value: round((v / c.close - 1) * 100) });
  }
  return out;
}
