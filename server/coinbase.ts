import { coinbaseWeeklyCloses as closes } from '../shared/coinbase';
import { fetchJson } from './http';

const BASE = 'https://api.exchange.coinbase.com';

export const coinbaseWeeklyCloses = (base: string, since: number) =>
  closes(base, since, <T>(u: string) => fetchJson<T>(u));

interface CbProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
  status: string;
  trading_disabled?: boolean;
}

export async function coinbaseUsdBases(): Promise<Set<string>> {
  const rows = await fetchJson<CbProduct[]>(`${BASE}/products`);
  return new Set(
    rows.filter((p) => p.quote_currency === 'USD' && p.status === 'online' && !p.trading_disabled).map((p) => p.base_currency),
  );
}
