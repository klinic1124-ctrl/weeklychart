const DAY = 86400;

/** 임의의 시각(초, UTC) → 그 주 월요일 00:00 UTC (초) */
export function weekStart(sec: number): number {
  const day = Math.floor(sec / DAY);
  // 1970-01-01 은 목요일. 월요일=0 이 되도록 보정
  const dow = (day + 3) % 7;
  return (day - dow) * DAY;
}

/** 'YYYY-MM-DD' (날짜만) → 그 주 월요일 00:00 UTC */
export function weekStartOfDate(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return weekStart(Date.UTC(y, m - 1, d) / 1000);
}
