import type { Plugin } from 'vite';
import type { Candle, CandlesResponse, CryptoExchanges, PremiumSources, SearchItem } from '../shared/types';
import { weekStart } from '../shared/week';

/** 심볼 문자열로 시드가 고정되는 난수 */
function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function walk(seed: string, weeks: number, start: number): Candle[] {
  const r = rng(seed);
  const now = weekStart(Date.now() / 1000);
  let p = start;
  const out: Candle[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const o = p;
    const c = o * (1 + (r() - 0.47) * 0.12);
    const h = Math.max(o, c) * (1 + r() * 0.05);
    const l = Math.min(o, c) * (1 - r() * 0.05);
    out.push({ time: now - i * 7 * 86400, open: o, high: h, low: l, close: c, volume: 1e6 * (0.5 + r() * 2) });
    p = c;
  }
  return out;
}

const EXCHANGES: CryptoExchanges = {
  upbit: [
    { base: 'BTC', ko: '비트코인', en: 'Bitcoin' },
    { base: 'ETH', ko: '이더리움', en: 'Ethereum' },
    { base: 'SOL', ko: '솔라나', en: 'Solana' },
  ],
  coinbase: ['BTC', 'ETH', 'SOL'],
  binance: [
    { symbol: 'BTCUSDT', lastPrice: '1', quoteVolume: '3000' },
    { symbol: 'ETHUSDT', lastPrice: '1', quoteVolume: '2000' },
    { symbol: 'SOLUSDT', lastPrice: '1', quoteVolume: '1000' },
    { symbol: 'BNBUSDT', lastPrice: '1', quoteVolume: '500' },
  ],
};

const STOCKS: SearchItem[] = [
  { type: 'stock', symbol: '005930.KS', name: '삼성전자', exchange: '코스피' },
  { type: 'stock', symbol: '000660.KS', name: 'SK하이닉스', exchange: '코스피' },
  { type: 'stock', symbol: '035720.KS', name: '카카오', exchange: '코스피' },
  { type: 'stock', symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  { type: 'stock', symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
];

export function mockApi(): Plugin {
  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const url = new URL(req.url, 'http://x');
        const send = (d: unknown) => {
          res.setHeader('Content-Type', 'application/json');
          setTimeout(() => res.end(JSON.stringify(d)), 200);
        };
        const sym = (url.searchParams.get('symbol') ?? url.searchParams.get('base') ?? '').toUpperCase();
        switch (url.pathname) {
          case '/api/stock/candles': {
            const kr = sym.endsWith('.KS') || sym.endsWith('.KQ');
            const d: CandlesResponse = {
              symbol: sym,
              name: STOCKS.find((s) => s.symbol === sym)?.name ?? sym,
              currency: kr ? 'KRW' : 'USD',
              candles: walk(sym, 1200, kr ? 3000 : 5),
            };
            return send(d);
          }
          case '/api/crypto/candles':
            return send({ symbol: sym + 'USDT', name: sym, currency: 'USDT', candles: walk(sym, 430, 4000) });
          case '/api/crypto/premium': {
            // 바이낸스 목업 종가에 프리미엄을 얹은 원천 데이터
            const c = walk(sym, 430, 4000);
            const r = rng(sym + 'p');
            let u = 2, cb = 0;
            const d: PremiumSources = {
              base: sym,
              upbit: c.slice(20).map((x) => [x.time, x.close * 1400 * (1 + (u += (r() - 0.5) * 1.5) / 100)]),
              coinbase: c.slice(60).map((x) => [x.time, x.close * (1 + (cb = cb * 0.7 + (r() - 0.5) * 0.4) / 100)]),
              usdkrw: c.map((x) => [x.time, 1400]),
            };
            return send(d);
          }
          case '/api/crypto/exchanges':
            return send(EXCHANGES);
          case '/api/stock/search': {
            const q = (url.searchParams.get('q') ?? '').toLowerCase();
            return send(STOCKS.filter((s) => s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)));
          }
        }
        res.statusCode = 404;
        send({ error: 'not found' });
      });
    },
  };
}
