import { describe, expect, it } from 'vitest';
import { toWeekly } from '../server/aggregate';
import { parseKlines } from '../server/binance';
import { parseCoinbaseDaily } from '../server/coinbase';
import { parseKoreanSymbol, parseNaverWeeklyXml } from '../server/naver';
import { coinbasePremium, upbitPremium } from '../server/premium';
import { parseUpbitWeeks } from '../server/upbit';
import { parseYahooWeekly } from '../server/yahoo';

const utc = (s: string) => Date.parse(s) / 1000;
const MON1 = utc('2024-01-01T00:00:00Z');
const MON2 = utc('2024-01-08T00:00:00Z');

describe('Yahoo 주봉 정규화', () => {
  it('한국 주식: 일요일 15:00 UTC(=월 00:00 KST) 를 월요일로, 진행 중 주 중복 병합', () => {
    const json = {
      chart: {
        error: null,
        result: [
          {
            meta: { symbol: '005930.KS', currency: 'KRW', gmtoffset: 32400, longName: 'Samsung Electronics' },
            timestamp: [utc('2023-12-31T15:00:00Z'), utc('2024-01-07T15:00:00Z'), utc('2024-01-10T06:30:00Z')],
            indicators: {
              quote: [
                {
                  open: [100, 110, 110],
                  high: [120, 125, 130],
                  low: [90, 105, 104],
                  close: [110, 120, 128],
                  volume: [1000, 2000, 2500],
                },
              ],
            },
          },
        ],
      },
    };
    const r = parseYahooWeekly(json);
    expect(r.name).toBe('Samsung Electronics');
    expect(r.candles.map((c) => c.time)).toEqual([MON1, MON2]);
    expect(r.candles[1]).toMatchObject({ open: 110, high: 130, low: 104, close: 128, volume: 2500 });
  });
  it('null 값 행은 건너뜀', () => {
    const r = parseYahooWeekly({
      chart: {
        error: null,
        result: [
          {
            meta: { symbol: 'AAPL', gmtoffset: -18000 },
            timestamp: [utc('2024-01-01T05:00:00Z'), utc('2024-01-08T05:00:00Z')],
            indicators: { quote: [{ open: [1, null], high: [2, null], low: [0.5, null], close: [1.5, null], volume: [10, null] }] },
          },
        ],
      },
    });
    expect(r.candles).toHaveLength(1);
    expect(r.candles[0].time).toBe(MON1);
  });
});

describe('네이버', () => {
  it('XML 파싱', () => {
    const xml = `<protocol><chartdata symbol="005930" name="삼성전자" count="2" timeframe="week">
      <item data="20240102|78200|79800|76500|77600|102345678" />
      <item data="20240108|77000|78000|73000|74700|90000000" /></chartdata></protocol>`;
    const r = parseNaverWeeklyXml(xml);
    expect(r.name).toBe('삼성전자');
    expect(r.candles.map((c) => c.time)).toEqual([MON1, MON2]);
    expect(r.candles[0].close).toBe(77600);
  });
  it('종목 코드 판별', () => {
    expect(parseKoreanSymbol('005930.KS')).toEqual({ code: '005930', suffix: 'KS' });
    expect(parseKoreanSymbol('035720.kq')).toEqual({ code: '035720', suffix: 'KQ' });
    expect(parseKoreanSymbol('AAPL')).toBeNull();
  });
});

describe('암호화폐', () => {
  it('바이낸스 kline', () => {
    const r = parseKlines([[MON1 * 1000, '1', '2', '0.5', '1.5', '100', 0]]);
    expect(r[0]).toEqual({ time: MON1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 });
  });
  it('업비트 주봉 키는 first_day_of_period 기준', () => {
    const m = parseUpbitWeeks([
      { candle_date_time_utc: '2024-01-08T00:00:00', candle_date_time_kst: '2024-01-08T09:00:00', first_day_of_period: '2024-01-08', trade_price: 2 },
      { candle_date_time_utc: '2023-12-31T15:00:00', candle_date_time_kst: '2024-01-01T00:00:00', trade_price: 1 },
    ]);
    expect(m.get(MON2)).toBe(2);
    expect(m.get(MON1)).toBe(1);
  });
  it('코인베이스 일봉(내림차순) → 월요일 기준 주봉 종가', () => {
    const rows = parseCoinbaseDaily([
      [MON2, 9, 11, 10, 10.5, 1],
      [MON2 - 86400, 9, 11, 10, 10.2, 1], // 일요일 → 첫째 주 종가
      [MON1, 8, 10, 9, 9.5, 1],
    ]);
    const w = toWeekly(rows);
    expect(w.map((c) => [c.time, c.open, c.close])).toEqual([
      [MON1, 9, 10.2],
      [MON2, 10, 10.5],
    ]);
  });
  it('프리미엄 계산 (환율 공백은 직전 값으로)', () => {
    const binance = [
      { time: MON1, open: 0, high: 0, low: 0, close: 100, volume: 0 },
      { time: MON2, open: 0, high: 0, low: 0, close: 200, volume: 0 },
    ];
    const upbit = new Map([
      [MON1, 1000 * 100 * 1.05],
      [MON2, 1000 * 200 * 0.98],
    ]);
    const fx = new Map([[MON1, 1000]]);
    expect(upbitPremium(binance, upbit, fx)).toEqual([
      { time: MON1, value: 5 },
      { time: MON2, value: -2 },
    ]);
    expect(coinbasePremium(binance, new Map([[MON2, 201]]))).toEqual([{ time: MON2, value: 0.5 }]);
  });
});
