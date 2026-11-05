/** 가격 크기에 맞는 소수 자릿수 */
export function decimalsFor(price: number, currency: string): number {
  if (currency === 'KRW') return price < 100 ? 2 : 0;
  const a = Math.abs(price);
  if (a >= 1000) return 2;
  if (a >= 1) return 2;
  if (a >= 0.01) return 4;
  if (a >= 0.0001) return 6;
  return 8;
}

export function fmtPrice(v: number, currency: string): string {
  const d = decimalsFor(v, currency);
  return v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtVolume(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(2) + '조';
  if (a >= 1e8) return (v / 1e8).toFixed(2) + '억';
  if (a >= 1e4) return (v / 1e4).toFixed(1) + '만';
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

export function fmtPct(v: number, digits = 2): string {
  return (v > 0 ? '+' : '') + v.toFixed(digits) + '%';
}

export function fmtWeek(sec: number): string {
  const d = new Date(sec * 1000);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')} 주`;
}

export function currencySymbol(c: string): string {
  return ({ KRW: '₩', USD: '$', USDT: '' } as Record<string, string>)[c] ?? '';
}
