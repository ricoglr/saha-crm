import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Check, Search, CornerDownLeft, type LucideIcon } from 'lucide-react';
import { ACTIONS, type LogEntry } from './util';

/** "● active" style status text */
export function Status({ s }: { s: string }) {
  const map: Record<string, [string, string]> = { active: ['ok', 'active'], suspended: ['warn', 'suspended'], deleted: ['bad', 'deleted'] };
  const [tone, label] = map[s] || ['muted', s];
  return <span className={'st ' + tone}><i />{label}</span>;
}

/** Short, copyable identifier chip */
export function IdChip({ value, short = 8, label }: { value: string; short?: number; label?: string }) {
  const [ok, setOk] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1200); } catch { /* blocked */ }
  };
  return (
    <button className="idchip" onClick={copy} title={`${value} (kopyala)`}>
      {label && <span className="k">{label}</span>}{short ? value.slice(0, short) : value}{ok ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

const ts = (s: string) => {
  const d = new Date(s);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const tone = (a: string) => (a.includes('delete') ? 'bad' : a.includes('suspend') ? 'warn' : a.includes('create') || a.includes('activate') ? 'ok' : a === 'login' ? 'dim' : 'info');
const detailText = (d: any) => (d ? Object.entries(d).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ') : '');

/** Terminal-style log view (always dark) */
export function Terminal({ log, title = 'audit.log', empty = 'kayıt yok', showIp = false }: { log: LogEntry[]; title?: string; empty?: string; showIp?: boolean }) {
  return (
    <div className="term">
      <div className="term-bar"><span className="dots"><i /><i /><i /></span><span>{title}</span><span className="grow" /><span className="cnt">{log.length} satır</span></div>
      <div className="term-body">
        {log.length ? log.map((l) => (
          <div key={l.id} className="tl" title={ACTIONS[l.action] || l.action}>
            <span className="t">[{ts(l.at)}]</span> <span className={'a ' + tone(l.action)}>{l.action.padEnd(15)}</span>
            {l.target && <span className="g"> {l.target}</span>}
            {l.details && <span className="d"> {detailText(l.details)}</span>}
            <span className="u"> by {l.actor_email || 'system'}</span>{showIp && l.ip && <span className="u"> from {l.ip}</span>}
          </div>
        )) : <div className="tl d">$ {empty}</div>}
        <div className="tl cursor">$ <i /></div>
      </div>
    </div>
  );
}

/** Live API health with round-trip time */
export function ApiStatus() {
  const [ms, setMs] = useState<number | null>(null);
  const [ok, setOk] = useState(true);
  useEffect(() => {
    let alive = true;
    const ping = async () => {
      const t0 = performance.now();
      try {
        const r = await fetch('/api/health', { cache: 'no-store' });
        if (!alive) return;
        setOk(r.ok); setMs(Math.round(performance.now() - t0));
      } catch { if (alive) { setOk(false); setMs(null); } }
    };
    ping();
    const iv = setInterval(ping, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  return (
    <span className={'api-pill ' + (ok ? 'ok' : 'bad')} title="API ve veritabanı sağlık kontrolü (15 sn'de bir)">
      <i />api {ok ? (ms != null ? `${ms}ms` : '…') : 'down'}
    </span>
  );
}

export type Command = { id: string; label: string; hint?: string; icon: LucideIcon; run: () => void; group: string };

/** Ctrl/⌘+K command palette */
export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => {
    const n = q.toLocaleLowerCase('tr').trim();
    return commands.filter((c) => !n || (c.label + ' ' + (c.hint || '') + ' ' + c.group).toLocaleLowerCase('tr').includes(n));
  }, [q, commands]);
  useEffect(() => setI(0), [q]);
  useEffect(() => { listRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }, [i]);
  const run = (c?: Command) => { if (!c) return; onClose(); c.run(); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(items[i]); }
    else if (e.key === 'Escape') onClose();
  };
  let lastGroup = '';
  return (
    <div className="cmdk-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk" role="dialog" aria-label="Komut paleti">
        <div className="cmdk-in"><Search size={16} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder="Komut veya firma ara…" /><kbd>esc</kbd></div>
        <div className="cmdk-list" ref={listRef}>
          {items.map((c, n) => {
            const head = c.group !== lastGroup ? (lastGroup = c.group) : null;
            return (
              <div key={c.id}>
                {head && <div className="cmdk-g">{head}</div>}
                <button className={n === i ? 'on' : ''} onMouseEnter={() => setI(n)} onClick={() => run(c)}>
                  <c.icon size={15} /><span className="l">{c.label}</span>{c.hint && <span className="h">{c.hint}</span>}{n === i && <CornerDownLeft size={13} className="ret" />}
                </button>
              </div>
            );
          })}
          {!items.length && <div className="cmdk-empty">Sonuç yok</div>}
        </div>
        <div className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> gezin</span><span><kbd>↵</kbd> çalıştır</span><span><kbd>esc</kbd> kapat</span></div>
      </div>
    </div>
  );
}
