import { useEffect, useMemo, useState } from 'react';
import type { AssetType, CandlesResponse, Point, PremiumResponse } from '../../shared/types';
import { rsi, sma } from '../../shared/indicators';
import { api } from '../lib/api';
import { C } from '../lib/colors';
import { favorites, useFavorites } from '../lib/favorites';
import { currencySymbol, fmtPct, fmtPrice, fmtVolume, fmtWeek } from '../lib/format';
import WeeklyChart, { type Indicators } from './WeeklyChart';

interface Props {
  type: AssetType;
  symbol: string;
  onBack: () => void;
}

const toMap = (pts: Point[]) => new Map(pts.map((p) => [p.time, p.value]));

export default function ChartView({ type, symbol, onBack }: Props) {
  const [data, setData] = useState<CandlesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [premium, setPremium] = useState<PremiumResponse | null>(null);
  const [premiumError, setPremiumError] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [cryptoName, setCryptoName] = useState<string | null>(null);
  const favs = useFavorites();
  const isCrypto = type === 'crypto';

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    setPremium(null);
    setPremiumError(null);
    api.candles(type, symbol).then(
      (d) => alive && (d.candles.length ? setData(d) : setError('표시할 데이터가 없습니다')),
      (e: Error) => alive && setError(e.message),
    );
    if (isCrypto) {
      api.cryptoMarkets().then(
        (ms) => {
          const m = ms.find((x) => x.base === symbol);
          if (alive && m?.koreanName) setCryptoName(`${m.koreanName} (${m.name})`);
        },
        () => {},
      );
      api.premium(symbol).then(
        (p) => alive && setPremium(p),
        (e: Error) => alive && setPremiumError(e.message),
      );
    }
    return () => {
      alive = false;
    };
  }, [type, symbol, isCrypto]);

  const ind = useMemo<Indicators | null>(() => {
    if (!data) return null;
    const t = data.candles.map((c) => c.time);
    const cl = data.candles.map((c) => c.close);
    return { ma50: sma(t, cl, 50), ma120: sma(t, cl, 120), ma200: sma(t, cl, 200), rsi: rsi(t, cl, 14) };
  }, [data]);

  const maps = useMemo(() => {
    if (!data || !ind) return null;
    return {
      idx: new Map(data.candles.map((c, i) => [c.time, i])),
      ma50: toMap(ind.ma50),
      ma120: toMap(ind.ma120),
      ma200: toMap(ind.ma200),
      rsi: toMap(ind.rsi),
      upbit: toMap(premium?.upbit ?? []),
      coinbase: toMap(premium?.coinbase ?? []),
    };
  }, [data, ind, premium]);

  const fav = favs.some((f) => f.type === type && f.symbol === symbol);
  const title = cryptoName ?? data?.name ?? symbol;
  const sub = isCrypto ? `${symbol}/USDT · 바이낸스` : `${symbol}${data?.currency ? ' · ' + data.currency : ''}`;

  let overlays: React.ReactNode[] = [];
  if (data && maps) {
    const cs = data.candles;
    const i = hover != null && maps.idx.has(hover) ? maps.idx.get(hover)! : cs.length - 1;
    const c = cs[i];
    const prev = cs[i - 1];
    const chg = prev ? (c.close / prev.close - 1) * 100 : 0;
    const cur = data.currency;
    const p = (v: number | undefined) => (v == null ? '-' : fmtPrice(v, cur));
    const pct = (v: number | undefined) => (v == null ? '-' : fmtPct(v));
    const dir = c.close >= c.open ? C.up : C.down;
    overlays = [
      <>
        <div>
          <span className="muted">{fmtWeek(c.time)}</span>{' '}
          <span className="muted">시</span> {p(c.open)} <span className="muted">고</span> {p(c.high)}{' '}
          <span className="muted">저</span> {p(c.low)} <span className="muted">종</span>{' '}
          <b style={{ color: dir }}>{p(c.close)}</b> <span style={{ color: chg >= 0 ? C.up : C.down }}>{fmtPct(chg)}</span>
        </div>
        <div>
          <span style={{ color: C.ma50 }}>MA50 {p(maps.ma50.get(c.time))}</span>{' '}
          <span style={{ color: C.ma120 }}>MA120 {p(maps.ma120.get(c.time))}</span>{' '}
          <span style={{ color: C.ma200 }}>MA200 {p(maps.ma200.get(c.time))}</span>
        </div>
      </>,
      <>
        <span className="muted">거래량</span> {fmtVolume(c.volume)}
      </>,
      <>
        <span className="muted">RSI(14)</span> {maps.rsi.get(c.time)?.toFixed(1) ?? '-'}
      </>,
    ];
    if (isCrypto) {
      overlays.push(
        premium ? (
          <>
            <span style={{ color: C.upbit }}>● 업비트 {pct(maps.upbit.get(c.time))}</span>{' '}
            <span style={{ color: C.coinbase }}>● 코인베이스 {pct(maps.coinbase.get(c.time))}</span>
            <span className="muted"> (별도 눈금)</span>
            {!premium.upbit.length && <span className="muted"> · 업비트 미상장</span>}
            {!premium.coinbase.length && <span className="muted"> · 코인베이스 미상장</span>}
            {premium.warnings?.length ? <span className="warn"> · 일부 조회 실패</span> : null}
          </>
        ) : premiumError ? (
          <span className="warn">프리미엄 조회 실패: {premiumError}</span>
        ) : (
          <span className="muted">프리미엄 불러오는 중…</span>
        ),
      );
    }
  }

  return (
    <div className="page chart-page">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="뒤로">
          ‹
        </button>
        <div className="title">
          <div className="name">{title}</div>
          <div className="sub">
            {sub}
            {data && (
              <>
                {' · '}
                {currencySymbol(data.currency)}
                {fmtPrice(data.candles[data.candles.length - 1].close, data.currency)}
              </>
            )}
          </div>
        </div>
        <button
          className={'icon-btn star' + (fav ? ' on' : '')}
          onClick={() => favorites.toggle({ type, symbol, name: title })}
          aria-label={fav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          {fav ? '★' : '☆'}
        </button>
      </header>
      {error ? (
        <div className="center">
          <p className="warn">불러오지 못했습니다</p>
          <p className="muted small">{error}</p>
        </div>
      ) : !data || !ind ? (
        <div className="center muted">불러오는 중…</div>
      ) : (
        <WeeklyChart
          candles={data.candles}
          currency={data.currency}
          ind={ind}
          showPremium={isCrypto}
          upbit={premium?.upbit ?? []}
          coinbase={premium?.coinbase ?? []}
          onHover={setHover}
          overlays={overlays}
        />
      )}
    </div>
  );
}
