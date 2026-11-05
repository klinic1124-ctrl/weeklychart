import { useEffect, useMemo, useState } from 'react';
import type { AssetType, CryptoMarket, SearchItem } from '../../shared/types';
import { api } from '../lib/api';
import { favorites, useFavorites, type Favorite } from '../lib/favorites';

interface Props {
  mode: AssetType;
  onMode: (m: AssetType) => void;
  onOpen: (f: Favorite) => void;
}

const SYMBOL_RE = /^([0-9]{6}(\.(KS|KQ))?|[A-Z][A-Z0-9.\-^=]{0,14})$/i;

export default function SearchPage({ mode, onMode, onOpen }: Props) {
  const [q, setQ] = useState('');
  const [markets, setMarkets] = useState<CryptoMarket[] | null>(null);
  const [stocks, setStocks] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const favs = useFavorites();

  useEffect(() => {
    if (mode !== 'crypto' || markets) return;
    api.cryptoMarkets().then(setMarkets, (e: Error) => setError(e.message));
  }, [mode, markets]);

  useEffect(() => {
    if (mode !== 'stock') return;
    const term = q.trim();
    if (!term) {
      setStocks([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api
        .searchStocks(term)
        .then(
          (r) => {
            setStocks(r);
            setError(null);
          },
          (e: Error) => setError(e.message),
        )
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, mode]);

  const items: SearchItem[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (mode === 'crypto') {
      const list = (markets ?? []).filter(
        (m) =>
          !term ||
          m.base.toLowerCase().startsWith(term) ||
          m.name.toLowerCase().includes(term) ||
          (m.koreanName ?? '').includes(term),
      );
      return list.slice(0, 80).map((m) => ({
        type: 'crypto' as const,
        symbol: m.base,
        name: m.koreanName ? `${m.koreanName} (${m.name})` : m.name,
        exchange: ['바이낸스', m.upbit && '업비트', m.coinbase && '코인베이스'].filter(Boolean).join(' · '),
      }));
    }
    const out = [...stocks];
    const raw = q.trim().toUpperCase();
    if (raw && SYMBOL_RE.test(raw) && !out.some((s) => s.symbol === raw)) {
      const sym = /^\d{6}$/.test(raw) ? `${raw}.KS` : raw;
      out.push({ type: 'stock', symbol: sym, name: `'${sym}' 바로 열기`, exchange: '심볼 직접 입력' });
    }
    return out;
  }, [mode, markets, stocks, q]);

  const isFav = (it: SearchItem) => favs.some((f) => f.type === it.type && f.symbol === it.symbol);
  const toFav = (it: SearchItem): Favorite => ({
    type: it.type,
    symbol: it.symbol,
    name: it.name.endsWith(' 바로 열기') ? it.symbol : it.name,
  });

  return (
    <div className="page">
      <header className="topbar column">
        <div className="seg">
          <button className={mode === 'stock' ? 'on' : ''} onClick={() => onMode('stock')}>
            주식
          </button>
          <button className={mode === 'crypto' ? 'on' : ''} onClick={() => onMode('crypto')}>
            암호화폐
          </button>
        </div>
        <input
          className="search"
          type="search"
          placeholder={mode === 'stock' ? '종목명 또는 코드 (삼성전자, 005930, AAPL)' : '코인 이름 또는 심볼 (비트코인, BTC)'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </header>
      {error && <p className="warn pad small">{error}</p>}
      {mode === 'crypto' && !markets && !error && <p className="muted pad">목록 불러오는 중…</p>}
      {mode === 'stock' && loading && <p className="muted pad small">검색 중…</p>}
      {mode === 'stock' && !q.trim() && (
        <p className="muted pad small">한국 주식은 종목명이나 6자리 코드로, 해외 주식은 티커(AAPL, TSLA)로 검색하세요.</p>
      )}
      <ul className="list">
        {items.map((it) => (
          <li key={it.type + it.symbol} className="row" onClick={() => onOpen(toFav(it))}>
            <div className="row-main">
              <div className="row-name">{it.name}</div>
              <div className="row-sub">
                {it.type === 'crypto' ? `${it.symbol}/USDT` : it.symbol} · {it.exchange}
              </div>
            </div>
            <button
              className={'icon-btn star' + (isFav(it) ? ' on' : '')}
              onClick={(e) => {
                e.stopPropagation();
                favorites.toggle(toFav(it));
              }}
              aria-label="즐겨찾기"
            >
              {isFav(it) ? '★' : '☆'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
