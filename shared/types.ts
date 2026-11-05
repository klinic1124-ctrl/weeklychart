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

/** [주 시작(초), 종가] */
export type Close = [number, number];

/** 프리미엄 계산용 원천 데이터 (바이낸스 종가는 클라이언트가 직접 받아 결합) */
export interface PremiumSources {
  base: string;
  /** 업비트 KRW 주봉 종가 */
  upbit: Close[];
  /** 코인베이스 USD 주봉 종가 (일봉 집계) */
  coinbase: Close[];
  /** USD/KRW 주봉 종가 */
  usdkrw: Close[];
  warnings?: string[];
}

export interface CryptoExchanges {
  upbit: { base: string; ko: string; en: string }[];
  coinbase: string[];
  /** 서버에서 바이낸스 조회가 가능할 때만 포함 */
  binance?: { symbol: string; lastPrice: string; quoteVolume: string }[];
}
