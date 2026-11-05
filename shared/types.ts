/** 모든 시간값은 해당 주의 월요일 00:00 UTC (초 단위) */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Point {
  time: number;
  value: number;
}

export type AssetType = 'stock' | 'crypto';

export interface CandlesResponse {
  symbol: string;
  name: string;
  currency: string;
  candles: Candle[];
}

export interface PremiumResponse {
  base: string;
  upbit: Point[];
  coinbase: Point[];
  /** 일부 소스 조회 실패 시 사유 */
  warnings?: string[];
}

export interface SearchItem {
  type: AssetType;
  symbol: string;
  name: string;
  /** 거래소/시장 표시용 (예: KOSPI, NASDAQ, Binance) */
  exchange: string;
}

export interface CryptoMarket {
  base: string;
  name: string;
  koreanName?: string;
  lastPrice: number;
  quoteVolume: number;
  upbit: boolean;
  coinbase: boolean;
}
