import { useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Megaphone } from 'lucide-react';
import { api } from '../api';
import { Empty, Field, Modal, Select } from '../components/primitives';
import { AnnouncementBody } from '../components/WhatsNew';
import { dt, useLoad } from './util';

type Ann = { id: number; title: string; body: string; audience: 'all' | 'admins'; published: boolean; created_by?: string; created_at: string; updated_at: string };
const AUD = { all: 'Tüm kullanıcılar', admins: 'Yalnızca firma yöneticileri' };

export default function Announcements() {
  const { data, reload, err } = useLoad(() => api<{ announcements: Ann[] }>('/api/platform/announcements'), []);
  const [edit, setEdit] = useState<Partial<Ann> | null>(null);
  const [msg, setMsg] = useState('');
  const toggle = async (a: Ann) => {
    await api(`/api/platform/announcements/${a.id}`, { ...a, published: !a.published }, 'PATCH');
    setMsg(a.published ? `#${a.id} yayından kaldırıldı.` : `#${a.id} yayınlandı.`); reload();
  };
  const del = async (a: Ann) => {
    if (!confirm(`"${a.title}" duyurusu silinsin mi?`)) return;
    await api(`/api/platform/announcements/${a.id}/delete`, {}); setMsg(`#${a.id} silindi.`); reload();
  };
  const list = data?.announcements || [];
  return (
    <div className="page">
      <div className="page-head"><h1>Duyurular</h1><button className="btn primary" onClick={() => setEdit({ audience: 'all', published: true, title: '', body: '' })}><Plus size={16} /> Yeni duyuru</button></div>
      <p className="muted lead">Yayınlanan duyuru, satış uygulamasında her kullanıcıya bir sonraki açılışında <b>bir kez</b> “Yenilikler” penceresi olarak gösterilir. Yeni eklenen kullanıcılar eski duyuruları görmez.</p>
      {err && <div className="notice bad">{err}</div>}
      {msg && <div className="notice">{msg}</div>}
      {list.length ? (
        <div className="ann-grid">
          {list.map((a) => (
            <section key={a.id} className={'card ann-card' + (a.published ? '' : ' draft')}>
              <div className="ann-meta">
                <span className="mono-sm">#{a.id}</span>
                <span className={'st ' + (a.published ? 'ok' : 'muted')}><i />{a.published ? 'published' : 'draft'}</span>
                <span className="mono-sm">audience={a.audience}</span>
                <span className="grow" />
                <span className="mono-sm">{dt(a.created_at)}{a.created_by ? ` · ${a.created_by}` : ''}</span>
              </div>
              <h3 className="ann-h">{a.title}</h3>
              <AnnouncementBody text={a.body} />
              <div className="row-actions" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
                <button className="btn xs" onClick={() => setEdit(a)}><Pencil size={13} /> Düzenle</button>
                <button className="btn xs" onClick={() => toggle(a)}>{a.published ? <><EyeOff size={13} /> Yayından kaldır</> : <><Eye size={13} /> Yayınla</>}</button>
                <button className="btn xs ic danger" onClick={() => del(a)} title="Sil" aria-label="Sil"><Trash2 size={13} /></button>
              </div>
            </section>
          ))}
        </div>
      ) : <Empty><Megaphone size={16} /> Henüz duyuru yok.</Empty>}
      {edit && <Editor initial={edit} onClose={() => setEdit(null)} onSaved={(m) => { setEdit(null); setMsg(m); reload(); }} />}
    </div>
  );
}

function Editor({ initial, onClose, onSaved }: { initial: Partial<Ann>; onClose: () => void; onSaved: (m: string) => void }) {
  const [v, setV] = useState({ title: initial.title || '', body: initial.body || '', audience: initial.audience || 'all', published: initial.published ?? true });
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initial.id) await api(`/api/platform/announcements/${initial.id}`, v, 'PATCH');
      else await api('/api/platform/announcements', v);
      onSaved(v.published ? 'Duyuru yayında; kullanıcılar uygulamayı açtığında görecek.' : 'Taslak kaydedildi.');
    } catch (x: any) { setErr(x.message); }
  };
  return (
    <Modal title={initial.id ? `Duyuruyu düzenle #${initial.id}` : 'Yeni duyuru'} onClose={onClose}
      footer={<><span className="grow" /><button className="btn ghost" onClick={onClose}>Vazgeç</button><button form="ann-form" className="btn primary">{v.published ? 'Yayınla' : 'Taslak olarak kaydet'}</button></>}>
      <form id="ann-form" className="grid" onSubmit={submit}>
        <Field label="Başlık" full><input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Örn. Yeni: teklifleri Excel'e aktarın" autoFocus /></Field>
        <Field label="Kime gösterilsin"><Select value={v.audience} onChange={(x) => setV({ ...v, audience: x as Ann['audience'] })} options={AUD} /></Field>
        <Field label="Durum"><Select value={v.published ? '1' : '0'} onChange={(x) => setV({ ...v, published: x === '1' })} options={{ '1': 'Yayında', '0': 'Taslak' }} /></Field>
        <Field label="Metin  ( “- ” ile başlayan satır = madde, **kalın** )" full>
          <textarea rows={8} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} className="mono-in"
            placeholder={'Kısa bir giriş cümlesi\n- **Yeni özellik:** ne işe yaradığı\n- İkinci madde\nİyi satışlar!'} />
        </Field>
        <div className="full">
          <p className="section-title">önizleme</p>
          <div className="wn-item" style={{ marginTop: 8 }}>
            <div className="wn-title"><b>{v.title || 'Başlık'}</b><span>bugün</span></div>
            <AnnouncementBody text={v.body || 'Metin burada görünecek.'} />
          </div>
        </div>
        {err && <p className="error full">{err}</p>}
      </form>
    </Modal>
  );
}
