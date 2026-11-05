import { useEffect, useState } from 'react';
import type { AssetType } from '../shared/types';
import ChartView from './components/ChartView';
import DiagPage from './components/DiagPage';
import FavoritesPage from './components/FavoritesPage';
import SearchPage from './components/SearchPage';
import type { Favorite } from './lib/favorites';

type Route =
  | { page: 'favorites' }
  | { page: 'diag' }
  | { page: 'search'; mode: AssetType }
  | { page: 'chart'; type: AssetType; symbol: string };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if (parts[0] === 'diag') return { page: 'diag' };
  if (parts[0] === 'search') return { page: 'search', mode: parts[1] === 'crypto' ? 'crypto' : 'stock' };
  if (parts[0] === 'chart' && (parts[1] === 'stock' || parts[1] === 'crypto') && parts[2]) {
    return { page: 'chart', type: parts[1], symbol: parts[2].toUpperCase() };
  }
  return { page: 'favorites' };
}

let navigatedInApp = false;
const go = (hash: string, replace = false) => {
  navigatedInApp = true;
  if (replace) location.replace(hash);
  else location.hash = hash;
};

export default function App() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));

  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const open = (f: Favorite) => go(`#/chart/${f.type}/${encodeURIComponent(f.symbol)}`);

  if (route.page === 'diag') return <DiagPage onBack={() => go('#/', true)} />;

  if (route.page === 'chart') {
    return (
      <ChartView
        key={route.type + route.symbol}
        type={route.type}
        symbol={route.symbol}
        onBack={() => (navigatedInApp && history.length > 1 ? history.back() : go('#/', true))}
      />
    );
  }

  return (
    <div className="shell">
      <main>
        {route.page === 'favorites' ? (
          <FavoritesPage onOpen={open} onSearch={() => go('#/search')} onDiag={() => go('#/diag')} />
        ) : (
          <SearchPage mode={route.mode} onMode={(m) => go(`#/search/${m}`, true)} onOpen={open} />
        )}
      </main>
      <nav className="tabbar">
        <button className={route.page === 'favorites' ? 'on' : ''} onClick={() => go('#/', true)}>
          <span className="ico">★</span>즐겨찾기
        </button>
        <button className={route.page === 'search' ? 'on' : ''} onClick={() => go('#/search', true)}>
          <span className="ico">⌕</span>검색
        </button>
      </nav>
    </div>
  );
}
