/** 연결 진단용 엔드포인트 (가벼운 요청만) */
export const PROBES: { name: string; url: string }[] = [
  { name: '바이낸스 data-api', url: 'https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1w&limit=1' },
  { name: '바이낸스 api', url: 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1w&limit=1' },
  { name: '업비트', url: 'https://api.upbit.com/v1/candles/weeks?market=KRW-BTC&count=1' },
  { name: '코인베이스', url: 'https://api.exchange.coinbase.com/products/BTC-USD/ticker' },
  { name: 'Yahoo', url: 'https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?interval=1wk&range=1mo' },
  { name: 'OKX', url: 'https://www.okx.com/api/v5/market/history-candles?instId=BTC-USDT&bar=1W&limit=1' },
  { name: 'Bybit', url: 'https://api.bybit.com/v5/market/kline?category=spot&symbol=BTCUSDT&interval=W&limit=1' },
  { name: 'CryptoCompare', url: 'https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USDT&e=Binance&limit=1' },
  { name: 'KuCoin', url: 'https://api.kucoin.com/api/v1/market/candles?type=1week&symbol=BTC-USDT' },
  { name: 'Gate', url: 'https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=BTC_USDT&interval=7d&limit=1' },
];

export interface ProbeResult {
  name: string;
  /** HTTP 상태 (0 = 연결 실패) */
  status: number;
  ms: number;
  note?: string;
}
