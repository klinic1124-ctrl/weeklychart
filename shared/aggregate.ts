import type { Candle } from './types';
import { weekStart } from './week';

/**
 * 시간순 정렬된 캔들(일봉 또는 중복 포함 주봉)을 주봉으로 합친다.
 * time 은 이미 '로컬 기준' 시각이어야 하며, 해당 주 월요일로 내림한다.
 */
export function toWeekly(rows: Candle[]): Candle[] {
  const sorted = [...rows].sort((a, b) => a.time - b.time);
  const out: Candle[] = [];
  for (const r of sorted) {
    const t = weekStart(r.time);
    const last = out[out.length - 1];
    if (last && last.time === t) {
      last.high = Math.max(last.high, r.high);
      last.low = Math.min(last.low, r.low);
      last.close = r.close;
      last.volume += r.volume;
    } else {
      out.push({ ...r, time: t });
    }
  }
  return out;
}
