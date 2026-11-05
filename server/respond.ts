import { HttpError } from './http';

export interface Ctx {
  request: Request;
  waitUntil(p: Promise<unknown>): void;
}

const CORS = { 'Access-Control-Allow-Origin': '*' };

export function json(data: unknown, status = 200, ttl = 0): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': ttl > 0 ? `public, max-age=${ttl}` : 'no-store',
      ...CORS,
    },
  });
}

export interface Result<T> {
  data: T;
  /** 캐시 시간(초). 0이면 캐시 안 함 */
  ttl: number;
}

/**
 * Cloudflare 엣지 캐시(Cache API)를 거치는 GET 핸들러.
 * 같은 URL 은 ttl 동안 외부 API 를 다시 호출하지 않는다.
 */
export async function cachedHandler<T>(ctx: Ctx, produce: (url: URL) => Promise<Result<T>>): Promise<Response> {
  const url = new URL(ctx.request.url);
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(url.toString(), { method: 'GET' });
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  try {
    const { data, ttl } = await produce(url);
    const res = json(data, 200, ttl);
    if (cache && ttl > 0) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    const status = e instanceof BadRequest ? 400 : e instanceof HttpError && e.status === 404 ? 404 : 502;
    return json({ error: e instanceof Error ? e.message : String(e) }, status);
  }
}

export class BadRequest extends Error {}

export function requireParam(url: URL, name: string, re: RegExp): string {
  const v = (url.searchParams.get(name) ?? '').trim();
  if (!re.test(v)) throw new BadRequest(`잘못된 파라미터: ${name}`);
  return v;
}
