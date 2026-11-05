import { useEffect, useState } from 'react';
import { PROBES, type ProbeResult } from '../../shared/probes';

/** 휴대폰(브라우저)에서 직접 접속 점검. CORS 실패와 연결 실패를 구분한다 */
async function probeDirect(name: string, url: string): Promise<ProbeResult> {
  const t0 = Date.now();
  const run = async (mode: RequestMode) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      return await fetch(url, { mode, signal: ctrl.signal, cache: 'no-store' });
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    const res = await run('cors');
    return { name, status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    try {
      await run('no-cors');
      return { name, status: 0, ms: Date.now() - t0, note: '접속은 되지만 브라우저 호출(CORS) 차단' };
    } catch (e2) {
      const msg = (e2 as Error).name === 'AbortError' ? '시간 초과' : (e as Error).message;
      return { name, status: 0, ms: Date.now() - t0, note: msg };
    }
  }
}

function Table({ rows }: { rows: ProbeResult[] | null }) {
  if (!rows) return <p className="muted pad small">점검 중… (최대 10초)</p>;
  return (
    <table className="diag">
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <td>{r.name}</td>
            <td className={r.status >= 200 && r.status < 300 ? 'ok' : 'bad'}>{r.status || '✕'}</td>
            <td className="muted">{r.ms}ms</td>
            <td className="muted small">{r.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DiagPage({ onBack }: { onBack: () => void }) {
  const [phone, setPhone] = useState<ProbeResult[] | null>(null);
  const [server, setServer] = useState<{ colo?: string; country?: string; results: ProbeResult[] } | null>(null);
  const [serverErr, setServerErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(PROBES.map((p) => probeDirect(p.name, p.url))).then(setPhone);
    fetch('/api/diag', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`/api/diag: HTTP ${r.status}`);
        return r.json();
      })
      .then(setServer, (e: Error) => setServerErr(e.message));
  }, []);

  return (
    <div className="page chart-page" style={{ overflowY: 'auto' }}>
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="뒤로">
          ‹
        </button>
        <div className="title">
          <div className="name">연결 진단</div>
          <div className="sub">빌드 {__BUILD__}</div>
        </div>
      </header>
      <h3 className="pad">휴대폰 → 직접</h3>
      <Table rows={phone} />
      <h3 className="pad">
        Cloudflare 서버 → {server ? `${server.colo ?? '?'} / ${server.country ?? '?'}` : ''}
      </h3>
      {serverErr ? <p className="warn pad">{serverErr}</p> : <Table rows={server?.results ?? null} />}
      <p className="muted pad small">이 화면을 캡처해서 보내주세요.</p>
    </div>
  );
}
