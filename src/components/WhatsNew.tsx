import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Sparkles, X, Megaphone } from 'lucide-react';
import { api } from '../api';
import { Empty, Modal } from './primitives';

export type Announcement = { id: number; title: string; body: string; audience: 'all' | 'admins'; created_at: string };

/** **bold** support inside a line */
function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>);
}

/** Plain-text body: lines starting with "- " become a bullet list, other lines paragraphs. */
export function AnnouncementBody({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (/^[-•*]\s+/.test(line)) list.push(line.replace(/^[-•*]\s+/, ''));
    else { flush(); blocks.push(<p key={blocks.length}>{inline(line)}</p>); }
  }
  flush();
  return <div className="ann-body">{blocks}</div>;
}

const when = (s: string) => new Date(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Pops up once per announcement, the first time the user opens the app after it was published. */
export function WhatsNew({ name }: { name: string }) {
  const [items, setItems] = useState<Announcement[]>([]);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      api<{ items: Announcement[] }>('/api/announcements').then((r) => alive && setItems(r.items)).catch(() => { /* offline: try next time */ });
    }, 900); // let the app settle first
    return () => { alive = false; clearTimeout(t); };
  }, []);
  if (!items.length) return null;
  const close = () => {
    const id = Math.max(...items.map((a) => a.id));
    setItems([]);
    api('/api/announcements/seen', { id }).catch(() => { /* will show again next time; harmless */ });
  };
  return (
    <div className="tour-bg" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="wn" role="dialog" aria-label="Yenilikler">
        <button className="icon-btn tour-skip" onClick={close} aria-label="Kapat"><X size={18} /></button>
        <div className="wn-head">
          <div className="wn-ic"><Sparkles size={26} strokeWidth={1.7} /></div>
          <h2>Merhaba {name.split(' ')[0]}, yenilikler var!</h2>
          <p className="muted">Siz yokken uygulamaya birkaç güzellik ekledik.</p>
        </div>
        <div className="wn-list">
          {items.map((a) => (
            <article key={a.id} className="wn-item">
              <div className="wn-title"><b>{a.title}</b><span>{when(a.created_at)}</span></div>
              <AnnouncementBody text={a.body} />
            </article>
          ))}
        </div>
        <div className="tour-foot"><span className="grow" /><button className="btn primary" onClick={close}>Harika, teşekkürler</button></div>
      </div>
    </div>
  );
}

/** All past announcements (opened from Settings). */
export function WhatsNewHistory({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api<{ items: Announcement[] }>('/api/announcements?all=1').then((r) => setItems(r.items)).catch((e) => setErr(e.message)); }, []);
  return (
    <Modal title="Yenilikler" onClose={onClose} footer={<><span className="grow" /><button className="btn primary" onClick={onClose}>Kapat</button></>}>
      {err && <p className="error">{err}</p>}
      {items && !items.length && <Empty><Megaphone size={16} /> Henüz duyuru yok.</Empty>}
      <div className="wn-list flat">
        {items?.map((a) => (
          <article key={a.id} className="wn-item">
            <div className="wn-title"><b>{a.title}</b><span>{when(a.created_at)}</span></div>
            <AnnouncementBody text={a.body} />
          </article>
        ))}
      </div>
    </Modal>
  );
}
