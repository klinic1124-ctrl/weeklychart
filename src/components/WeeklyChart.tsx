import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle, Point } from '../../shared/types';
import { C } from '../lib/colors';
import { decimalsFor, fmtVolume } from '../lib/format';

export interface Indicators {
  ma50: Point[];
  ma120: Point[];
  ma200: Point[];
  rsi: Point[];
}

interface Props {
  candles: Candle[];
  currency: string;
  ind: Indicators;
  showPremium: boolean;
  upbit: Point[];
  coinbase: Point[];
  /** 십자선 위치의 주(초). null 이면 최신 */
  onHover: (time: number | null) => void;
  /** 각 페인 좌상단에 겹쳐 표시할 범례 */
  overlays: ReactNode[];
}

const ts = (t: number) => t as UTCTimestamp;
const line = (pts: Point[]) => pts.map((p) => ({ time: ts(p.time), value: p.value }));
const pctFormat = { type: 'custom' as const, formatter: (v: number) => v.toFixed(2) + '%', minMove: 0.01 };

export default function WeeklyChart({ candles, currency, ind, showPremium, upbit, coinbase, onHover, overlays }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const [tops, setTops] = useState<number[]>([]);
  const premiumRef = useRef<{ up: ISeriesApi<'Line'>; cb: ISeriesApi<'Line'> } | null>(null);
  const hoverRef = useRef(onHover);
  hoverRef.current = onHover;

  // 차트 생성 (종목이 바뀔 때마다 새로 만든다)
  useEffect(() => {
    if (!el.current || !candles.length) return;
    const chart: IChartApi = createChart(el.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: C.bg },
        textColor: C.text,
        fontSize: 10,
        panes: { separatorColor: C.border, separatorHoverColor: C.border, enableResize: false },
      },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      rightPriceScale: { borderColor: C.border, minimumWidth: 64 },
      timeScale: { borderColor: C.border, rightOffset: 3, minBarSpacing: 0.5 },
      crosshair: { mode: CrosshairMode.Normal },
      localization: { locale: 'ko-KR', dateFormat: 'yyyy.MM.dd' },
    });

    const last = candles[candles.length - 1].close;
    const precision = decimalsFor(last, currency);
    const priceFormat = { type: 'price' as const, precision, minMove: Math.pow(10, -precision) };

    // ── 0: 캔들 + 이동평균
    const main = chart.addSeries(CandlestickSeries, {
      upColor: C.up,
      downColor: C.down,
      borderUpColor: C.up,
      borderDownColor: C.down,
      wickUpColor: C.up,
      wickDownColor: C.down,
      priceFormat,
    });
    main.setData(candles.map((c) => ({ time: ts(c.time), open: c.open, high: c.high, low: c.low, close: c.close })));
    const maOpts = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat };
    chart.addSeries(LineSeries, { ...maOpts, color: C.ma50 }).setData(line(ind.ma50));
    chart.addSeries(LineSeries, { ...maOpts, color: C.ma120 }).setData(line(ind.ma120));
    chart.addSeries(LineSeries, { ...maOpts, color: C.ma200, lineWidth: 2 }).setData(line(ind.ma200));

    // ── 1: 거래량
    const vol = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: 'custom', formatter: fmtVolume, minMove: 1 },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1,
    );
    vol.setData(candles.map((c) => ({ time: ts(c.time), value: c.volume, color: c.close >= c.open ? C.upA : C.downA })));

    // ── 2: RSI(14)
    const rsi = chart.addSeries(
      LineSeries,
      {
        color: C.rsi,
        lineWidth: 1,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
        autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
      },
      2,
    );
    rsi.setData(line(ind.rsi));
    rsi.priceScale().applyOptions({ scaleMargins: { top: 0.12, bottom: 0.05 } });
    for (const [price, color] of [
      [70, C.up],
      [30, C.down],
    ] as const) {
      rsi.createPriceLine({ price, color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
    }

    // ── 3: 업비트 / 코인베이스 프리미엄 (암호화폐)
    if (showPremium) {
      const opts = { lineWidth: 1 as const, priceLineVisible: false, crosshairMarkerVisible: false, priceFormat: pctFormat };
      const up = chart.addSeries(LineSeries, { ...opts, color: C.upbit }, 3);
      // 코인베이스 프리미엄은 보통 ±0.5% 수준이라 업비트(±10%)와 같은 눈금이면 평평하게 보인다.
      // → 같은 페인에 겹치되 별도(오버레이) 눈금을 사용하고, 각자 0% 기준선을 그린다.
      const cb = chart.addSeries(LineSeries, { ...opts, color: C.coinbase, priceScaleId: 'coinbase' }, 3);
      cb.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0.1 } });
      up.createPriceLine({ price: 0, color: C.upbit, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
      cb.createPriceLine({ price: 0, color: C.coinbase, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
      premiumRef.current = { up, cb };
    }

    const panes = chart.panes();
    const factors = showPremium ? [5, 1.3, 1.3, 1.7] : [5, 1.5, 1.5];
    panes.forEach((p, i) => p.setStretchFactor(factors[i] ?? 1));

    // 초기 표시 범위: 화면 폭에 맞춰 최근 N주 (핀치로 확대/축소 가능)
    const width = el.current.clientWidth;
    const bars = Math.min(candles.length, Math.max(60, Math.round(width / 3.2)));
    chart.timeScale().setVisibleLogicalRange({ from: candles.length - bars, to: candles.length + 2 });

    chart.subscribeCrosshairMove((p) => hoverRef.current(p.time != null ? (p.time as number) : null));

    // 페인 위치를 측정해 범례를 겹쳐 놓는다
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const base = el.current?.getBoundingClientRect().top ?? 0;
        setTops(chart.panes().map((p) => (p.getHTMLElement()?.getBoundingClientRect().top ?? base) - base));
      });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el.current);
    measure();

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      premiumRef.current = null;
      chart.remove();
    };
  }, [candles, currency, ind, showPremium]);

  // 프리미엄은 늦게 도착하므로 별도로 갱신
  useEffect(() => {
    premiumRef.current?.up.setData(line(upbit));
    premiumRef.current?.cb.setData(line(coinbase));
  }, [upbit, coinbase, candles, showPremium]);

  return (
    <div className="chart-wrap">
      <div ref={el} className="chart" />
      {overlays.map((o, i) =>
        tops[i] == null ? null : (
          <div key={i} className="pane-legend" style={{ top: tops[i] + 4 }}>
            {o}
          </div>
        ),
      )}
    </div>
  );
}
