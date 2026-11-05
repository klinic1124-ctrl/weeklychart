import type { Candle, CandlesResponse, SearchItem } from '../shared/types';
import { weekStartOfDate } from '../shared/week';
import { fetchJson, fetchText } from './http';

/** 한국 종목 코드 판별: 005930, 005930.KS, 035720.KQ */
export function parseKoreanSymbol(symbol: string): { code: string; suffix: 'KS' | 'KQ' } | null {
  const m = /^(\d{6}|[0-9A-Z]{6})\.(KS|KQ)$/i.exec(symbol.trim());
  return m ? { code: m[1].toUpperCase(), suffix: m[2].toUpperCase() as 'KS' | 'KQ' } : null;
}

/**
 * 네이버 금융 주봉 (XML). Yahoo 실패 시 한국 주식 대체 소스.
 * <item data="20240102|78200|79800|76500|77600|102345678" />
 */
export function parseNaverWeeklyXml(xml: string): { name: string; candles: Candle[] } {
  const name = /name="([^"]*)"/.exec(xml)?.[1] ?? '';
  const candles: Candle[] = [];
  for (const m of xml.matchAll(/data="(\d{8})\|([\d.]+)\|([\d.]+)\|([\d.]+)\|([\d.]+)\|([\d.]+)"/g)) {
    const d = m[1];
    const t = weekStartOfDate(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`);
    const [o, h, l, c, v] = m.slice(2).map(Number);
    if (!o || !c) continue;
    const last = candles[candles.length - 1];
    if (last && last.time === t) {
      last.high = Math.max(last.high, h);
      last.low = Math.min(last.low, l);
      last.close = c;
      last.volume += v;
    } else {
      candles.push({ time: t, open: o, high: h, low: l, close: c, volume: v });
    }
  }
  return { name, candles };
}

export async function naverWeekly(symbol: string): Promise<CandlesResponse> {
  const k = parseKoreanSymbol(symbol);
  if (!k) throw new Error('한국 종목 코드가 아닙니다');
  const xml = await fetchText(
    `https://fchart.stock.naver.com/sise.nhn?symbol=${k.code}&timeframe=week&count=1500&requestType=0`,
  );
  const { name, candles } = parseNaverWeeklyXml(xml);
  if (!candles.length) throw new Error('데이터 없음');
  return { symbol: `${k.code}.${k.suffix}`, name: name || k.code, currency: 'KRW', candles };
}

interface NaverAc {
  items?: {
    code: string;
    name: string;
    typeCode?: string;
    typeName?: string;
    nationCode?: string;
    category?: string;
  }[];
}

/** 네이버 자동완성 – 한글 종목명 검색용 (국내 주식만 사용) */
export async function naverSearch(q: string): Promise<SearchItem[]> {
  const json = await fetchJson<NaverAc>(
    `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock,ETF`,
  );
  return (json.items ?? [])
    .filter((x) => (x.nationCode ?? 'KOR') === 'KOR' && /^[0-9A-Z]{6}$/.test(x.code))
    .map((x) => {
      const kosdaq = (x.typeCode ?? '').toUpperCase().includes('KOSDAQ');
      return {
        type: 'stock' as const,
        symbol: `${x.code}.${kosdaq ? 'KQ' : 'KS'}`,
        name: x.name,
        exchange: x.typeName ?? (kosdaq ? '코스닥' : '코스피'),
      };
    });
}
