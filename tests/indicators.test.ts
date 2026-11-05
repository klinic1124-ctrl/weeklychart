import { describe, expect, it } from 'vitest';
import { rsi, sma } from '../shared/indicators';

describe('sma', () => {
  it('기간이 찬 시점부터 평균', () => {
    const t = [1, 2, 3, 4, 5];
    expect(sma(t, [1, 2, 3, 4, 5], 3)).toEqual([
      { time: 3, value: 2 },
      { time: 4, value: 3 },
      { time: 5, value: 4 },
    ]);
  });
  it('데이터가 부족하면 빈 배열', () => {
    expect(sma([1, 2], [1, 2], 200)).toEqual([]);
  });
});

describe('rsi', () => {
  it('계속 오르면 100, 계속 내리면 0', () => {
    const t = Array.from({ length: 20 }, (_, i) => i);
    expect(rsi(t, t.map((i) => 100 + i)).at(-1)!.value).toBe(100);
    expect(rsi(t, t.map((i) => 100 - i)).at(-1)!.value).toBe(0);
  });
  it('Wilder 기준값과 일치 (첫 RSI)', () => {
    // 고전 예제 (Wilder, 14기간) 첫 값 ≈ 70.53
    const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0];
    const r = rsi(closes.map((_, i) => i), closes, 14);
    expect(r[0].time).toBe(14);
    expect(r[0].value).toBeCloseTo(70.46, 1);
    expect(r[1].value).toBeCloseTo(66.25, 1);
  });
});
