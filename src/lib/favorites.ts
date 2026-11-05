import { useSyncExternalStore } from 'react';
import type { AssetType } from '../../shared/types';

export interface Favorite {
  type: AssetType;
  symbol: string;
  name: string;
}

const KEY = 'weekly-chart:favorites:v1';
const listeners = new Set<() => void>();
let cache: Favorite[] = load();

function load(): Favorite[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function save(next: Favorite[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 저장 불가(사파리 개인정보 보호 모드 등) – 메모리에만 유지 */
  }
  listeners.forEach((l) => l());
}

const same = (a: Favorite, type: AssetType, symbol: string) => a.type === type && a.symbol === symbol;

export const favorites = {
  isFav: (type: AssetType, symbol: string) => cache.some((f) => same(f, type, symbol)),
  toggle(f: Favorite) {
    save(this.isFav(f.type, f.symbol) ? cache.filter((x) => !same(x, f.type, f.symbol)) : [...cache, f]);
  },
  remove: (f: Favorite) => save(cache.filter((x) => !same(x, f.type, f.symbol))),
  move(index: number, delta: number) {
    const j = index + delta;
    if (j < 0 || j >= cache.length) return;
    const next = [...cache];
    [next[index], next[j]] = [next[j], next[index]];
    save(next);
  },
};

window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    cache = load();
    listeners.forEach((l) => l());
  }
});

export function useFavorites(): Favorite[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cache,
  );
}
