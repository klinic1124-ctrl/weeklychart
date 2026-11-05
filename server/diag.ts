import { PROBES, type ProbeResult } from '../shared/probes';
import type { Ctx } from './respond';
import { json } from './respond';

const UA = 'Mozilla/5.0 (compatible; weekly-chart/1.0)';

async function probe(name: string, url: string): Promise<ProbeResult> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctrl.signal });
    const text = await res.text();
    return { name, status: res.status, ms: Date.now() - t0, ...(res.ok ? {} : { note: text.slice(0, 80) }) };
  } catch (e) {
    return { name, status: 0, ms: Date.now() - t0, note: ctrl.signal.aborted ? '시간 초과' : String(e).slice(0, 80) };
  } finally {
    clearTimeout(timer);
  }
}

/** Cloudflare 서버에서 각 데이터 소스에 접속 가능한지 점검 */
export async function diag(ctx: Ctx): Promise<Response> {
  const cf = (ctx.request as unknown as { cf?: { colo?: string; country?: string } }).cf;
  const results = await Promise.all(PROBES.map((p) => probe(p.name, p.url)));
  return json({ colo: cf?.colo, country: cf?.country, results });
}
