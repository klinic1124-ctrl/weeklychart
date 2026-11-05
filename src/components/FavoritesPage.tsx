import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { C } from '../lib/colors';
import { favorites, useFavorites, type Favorite } from '../lib/favorites';
import { fmtPct, fmtPrice } from '../lib/format';

interface Props {
  onOpen: (f: Favorite) => void;
  onSearch: () => void;
  onDiag: () => void;
}

function Quote({ f }: { f: Favorite }) {
  const [q, setQ] = useState<{ price: number; chg: number; cur: string } | null>(null);
  useEffect(() => {
    let alive = true;
    api.candles(f.type, f.symbol).then(
      (d) => {
        const cs = d.candles;
        if (!alive || cs.length < 1) return;
        const last = cs[cs.length - 1];
        const prev = cs[cs.length - 2];
        setQ({ price: last.close, chg: prev ? (last.close / prev.close - 1) * 100 : 0, cur: d.currency });
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [f.type, f.symbol]);
  if (!q) return <div className="quote muted">…</div>;
  return (
    <div className="quote">
      <div>{fmtPrice(q.price, q.cur)}</div>
      <div className="small" style={{ color: q.chg >= 0 ? C.up : C.down }}>
        주간 {fmtPct(q.chg)}
      </div>
    </div>
  );
}

export default function FavoritesPage({ onOpen, onSearch, onDiag }: Props) {
  const list = useFavorites();
  const [edit, setEdit] = useState(false);

  return (
    <div className="page">
      <header className="topbar">
        <div className="title">
          <div className="name big">즐겨찾기</div>
        </div>
        {list.length > 0 && (
          <button className="text-btn" onClick={() => setEdit(!edit)}>
            {edit ? '완료' : '편집'}
          </button>
        )}
      </header>
      {list.length === 0 ? (
        <div className="center">
          <p className="muted">즐겨찾기한 종목이 없습니다</p>
          <button className="primary" onClick={onSearch}>
            종목 검색하기
          </button>
        </div>
      ) : (
        <ul className="list">
          {list.map((f, i) => (
            <li key={f.type + f.symbol} className="row" onClick={() => !edit && onOpen(f)}>
              <span className={'badge ' + f.type}>{f.type === 'crypto' ? '코인' : '주식'}</span>
              <div className="row-main">
                <div className="row-name">{f.name}</div>
                <div className="row-sub">{f.type === 'crypto' ? `${f.symbol}/USDT` : f.symbol}</div>
              </div>
              {edit ? (
                <div className="edit-btns">
                  <button onClick={() => favorites.move(i, -1)} disabled={i === 0} aria-label="위로">
                    ▲
                  </button>
                  <button onClick={() => favorites.move(i, 1)} disabled={i === list.length - 1} aria-label="아래로">
                    ▼
                  </button>
                  <button className="del" onClick={() => favorites.remove(f)} aria-label="삭제">
                    ✕
                  </button>
                </div>
              ) : (
                <Quote f={f} />
              )}
            </li>
          ))}
        </ul>
      )}
      <button className="footer-link" onClick={onDiag}>
        연결 진단 · 빌드 {__BUILD__}
      </button>
    </div>
  );
}
