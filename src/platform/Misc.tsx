import { useState } from 'react';
import { UserPlus, KeyRound } from 'lucide-react';
import { api } from '../api';
import { Badge, Empty, Field, Modal, Select } from '../components/primitives';
import { relDays } from '../format';
import { ACTIONS, dt, genPassword, useLoad, type Admin, type LogEntry } from './util';
import { Credentials } from './Tenants';

type PAdmin = Admin & { active: boolean; created_at: string; last_login_at?: string };

export function Admins({ me }: { me: Admin }) {
  const { data, reload } = useLoad(() => api<{ admins: PAdmin[] }>('/api/platform/admins'), []);
  const [adding, setAdding] = useState(false);
  const [creds, setCreds] = useState<{ who: string; email: string; password: string } | null>(null);
  const [err, setErr] = useState('');
  const patch = async (a: PAdmin, body: object, after?: () => void) => {
    setErr('');
    try { await api(`/api/platform/admins/${a.id}`, body, 'PATCH'); after?.(); reload(); } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="page">
      <div className="page-head"><h1>Platform yöneticileri</h1><button className="btn primary" onClick={() => setAdding(true)}><UserPlus size={16} /> Yönetici ekle</button></div>
      <p className="muted lead">Bu hesaplar tüm firmaları yönetebilir. Yalnızca yazılım ekibinize verin.</p>
      {err && <div className="notice bad">{err}</div>}
      <section className="card flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Ad</th><th>E-posta</th><th>Durum</th><th>Son giriş</th><th>Eklenme</th><th></th></tr></thead>
            <tbody>
              {(data?.admins || []).map((a) => (
                <tr key={a.id} className={a.active ? '' : 'dim'}>
                  <td><b>{a.name}</b>{a.id === me.id && <span className="muted"> (siz)</span>}</td><td>{a.email}</td>
                  <td>{a.active ? <Badge tone="green">Aktif</Badge> : <Badge>Devre dışı</Badge>}</td>
                  <td>{a.last_login_at ? relDays(a.last_login_at) : 'hiç'}</td><td>{dt(a.created_at)}</td>
                  <td><div className="row-actions">{a.id !== me.id && <>
                    <button className="btn xs" onClick={() => { const password = genPassword(16); if (confirm(`${a.name} için yeni şifre oluşturulsun mu?`)) patch(a, { password }, () => setCreds({ who: a.name, email: a.email, password })); }}><KeyRound size={13} /> Şifre</button>
                    <button className="btn xs" onClick={() => patch(a, { active: !a.active })}>{a.active ? 'Devre dışı' : 'Aktifleştir'}</button>
                  </>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {adding && <AddPlatformAdmin onClose={() => setAdding(false)} onCreated={(c) => { setAdding(false); setCreds(c); reload(); }} />}
      {creds && <Credentials title="Platform yöneticisi giriş bilgileri" who={creds.who} email={creds.email} password={creds.password} onClose={() => setCreds(null)} />}
    </div>
  );
}

function AddPlatformAdmin({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { who: string; email: string; password: string }) => void }) {
  const [v, setV] = useState({ name: '', email: '', password: genPassword(16) });
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api('/api/platform/admins', v); onCreated({ who: v.name, email: v.email.trim().toLowerCase(), password: v.password }); } catch (x: any) { setErr(x.message); }
  };
  return (
    <Modal title="Platform yöneticisi ekle" onClose={onClose} footer={<><span className="grow" /><button className="btn ghost" onClick={onClose}>Vazgeç</button><button form="add-padmin" className="btn primary">Ekle</button></>}>
      <form id="add-padmin" className="grid" onSubmit={submit}>
        <Field label="Ad soyad *"><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></Field>
        <Field label="E-posta *"><input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field label="İlk şifre (en az 10 karakter)" full><input value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} className="mono" /></Field>
        {err && <p className="error full">{err}</p>}
      </form>
    </Modal>
  );
}

export function Audit() {
  const [filter, setFilter] = useState('');
  const { data } = useLoad(() => api<{ log: LogEntry[] }>('/api/platform/audit?limit=500'), []);
  const log = (data?.log || []).filter((l) => !filter || l.action === filter);
  return (
    <div className="page">
      <div className="page-head"><h1>İşlem kaydı</h1></div>
      <div className="filters"><Select value={filter} onChange={setFilter} options={ACTIONS} empty="Tüm işlemler" /></div>
      <section className="card flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Zaman</th><th>İşlem</th><th>Hedef</th><th>Ayrıntı</th><th>Kim</th><th>IP</th></tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td>{dt(l.at)}</td><td>{ACTIONS[l.action] || l.action}</td><td><span className="mono-sm">{l.target || ''}</span></td>
                  <td className="mono-sm">{l.details ? Object.entries(l.details).map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join(', ') : x}`).join(' · ') : ''}</td>
                  <td>{l.actor_email || '—'}</td><td className="mono-sm">{l.ip || ''}</td>
                </tr>
              ))}
              {!log.length && <tr><td colSpan={6}><Empty>Kayıt yok.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function Account({ admin }: { admin: Admin }) {
  const [v, setV] = useState({ current: '', next: '', again: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (v.next !== v.again) return setMsg({ ok: false, text: 'Yeni şifreler aynı değil.' });
    try { await api('/api/platform/me/password', { current: v.current, next: v.next }); setV({ current: '', next: '', again: '' }); setMsg({ ok: true, text: 'Şifreniz değiştirildi.' }); }
    catch (x: any) { setMsg({ ok: false, text: x.message }); }
  };
  return (
    <div className="page narrow">
      <div className="page-head"><h1>Hesabım</h1></div>
      {msg && <div className={msg.ok ? 'notice' : 'notice bad'}>{msg.text}</div>}
      <section className="card">
        <div className="kv"><span>Ad</span><b>{admin.name}</b><span>E-posta</span><b>{admin.email}</b></div>
        <h3>Şifre değiştir</h3>
        <form className="grid" onSubmit={submit}>
          <Field label="Mevcut şifre" full><input type="password" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} /></Field>
          <Field label="Yeni şifre (en az 10 karakter)"><input type="password" autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} /></Field>
          <Field label="Yeni şifre (tekrar)"><input type="password" autoComplete="new-password" value={v.again} onChange={(e) => setV({ ...v, again: e.target.value })} /></Field>
          <div className="full"><button className="btn primary" disabled={!v.current || v.next.length < 10}>Şifreyi değiştir</button></div>
        </form>
      </section>
    </div>
  );
}
