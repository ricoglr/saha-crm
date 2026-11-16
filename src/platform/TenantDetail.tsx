import { useState } from 'react';
import { ChevronLeft, Pencil, PauseCircle, PlayCircle, Download, Trash2, UserPlus, KeyRound, Braces, Power, PowerOff } from 'lucide-react';
import { DeleteUserModal } from '../components/DeleteUserModal';
import { api } from '../api';
import { Badge, Empty, Field, Modal, Select } from '../components/primitives';
import { num, relDays } from '../format';
import { bytes, dt, genPassword, useLoad, type LogEntry, type Tenant, type Usage } from './util';
import { Credentials, StatusBadge } from './Tenants';
import { IdChip, Terminal } from './ui';

type TUser = { id: string; email: string; name: string; role: 'admin' | 'rep'; active: boolean; created_at: string; last_login_at?: string; last_sync_at?: string; customers: number; visits: number };
type Detail = { tenant: Tenant; usage: Usage; users: TUser[]; log: LogEntry[] };

export default function TenantDetail({ id }: { id: string }) {
  const { data, err, reload } = useLoad(() => api<Detail>(`/api/platform/tenants/${id}`), [id]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [creds, setCreds] = useState<{ who: string; email: string; password: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [delUser, setDelUser] = useState<TUser | null>(null);
  if (err) return <div className="page"><a href="#/firmalar" className="back"><ChevronLeft size={16} /> Firmalar</a><div className="notice bad">{err}</div></div>;
  if (!data) return null;
  const { tenant: t, usage: u, users } = data;
  const act = async (fn: () => Promise<unknown>, ok?: string) => { setMsg(''); try { await fn(); if (ok) setMsg(ok); reload(); } catch (e: any) { setMsg('Hata: ' + e.message); } };
  const toggle = () => {
    const suspend = t.status === 'active';
    if (suspend && !confirm(`${t.name} askıya alınsın mı?\n\nFirmanın tüm kullanıcıları anında oturumdan çıkarılır ve giriş yapamaz. Veriler silinmez.`)) return;
    act(() => api(`/api/platform/tenants/${t.id}`, { status: suspend ? 'suspended' : 'active' }, 'PATCH'), suspend ? 'Firma askıya alındı.' : 'Firma yeniden aktif.');
  };
  const resetPw = (x: TUser) => {
    if (!confirm(`${x.name} için yeni şifre oluşturulsun mu? Kullanıcı tüm cihazlarda oturumdan çıkar.`)) return;
    const password = genPassword();
    act(async () => { await api(`/api/platform/tenants/${t.id}/users/${x.id}`, { password }, 'PATCH'); setCreds({ who: x.name, email: x.email, password }); });
  };

  return (
    <div className="page">
      <a href="#/firmalar" className="back"><ChevronLeft size={16} /> Firmalar</a>
      <div className="card">
        <div className="tenant-head">
          <div>
            <h1>{t.name} <StatusBadge s={t.status} />{t.is_legacy && <Badge>İlk kurulum</Badge>}</h1>
            <div className="meta-row">
              <IdChip value={t.id} label="id" /><IdChip value={t.slug} short={0} label="kod" /><IdChip value={t.db_name} short={0} label="db" />
              <span className="mono-sm">oluşturma {dt(t.created_at)}</span>
            </div>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => setEditing(true)}><Pencil size={15} /> Düzenle</button>
            <button className="btn" onClick={toggle}>{t.status === 'active' ? <><PauseCircle size={15} /> Askıya al</> : <><PlayCircle size={15} /> Aktifleştir</>}</button>
            <a className="btn" href={`/api/platform/tenants/${t.id}/export`} onClick={() => setTimeout(reload, 1500)}><Download size={15} /> Yedek indir</a>
          </div>
        </div>
      </div>
      {msg && <div className={msg.startsWith('Hata') ? 'notice bad' : 'notice'}>{msg}</div>}

      <div className="stats six">
        <div className="stat"><span>users.active</span><b>{u?.active_users ?? '—'}{t.max_users ? <small className="of"> / {t.max_users}</small> : null}</b><small>limit: {t.max_users || '∞'}</small></div>
        <div className="stat"><span>customers</span><b>{num(u?.customers)}</b></div>
        <div className="stat"><span>visits</span><b>{num(u?.visits)}</b></div>
        <div className="stat"><span>quotes</span><b>{num(u?.quotes)}</b></div>
        <div className="stat"><span>db.size</span><b>{bytes(u?.db_bytes)}</b></div>
        <div className="stat"><span>last_activity</span><b>{u?.last_activity ? relDays(u.last_activity) : 'hiç'}</b></div>
      </div>

      <section className="card flush">
        <div className="page-head pad-h"><h3 style={{ margin: 0 }}>Kullanıcılar</h3><button className="btn sm" onClick={() => setAdding(true)}><UserPlus size={14} /> Yönetici ekle</button></div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="table">
            <thead><tr><th>Ad</th><th>E-posta</th><th>Yetki</th><th>Durum</th><th className="n">Müşteri</th><th className="n">Görüşme</th><th>Son giriş</th><th className="n">işlem</th></tr></thead>
            <tbody>
              {users.map((x) => (
                <tr key={x.id} className={x.active ? '' : 'dim'}>
                  <td><b>{x.name}</b><div><IdChip value={x.id} /></div></td><td><code className="code">{x.email}</code></td>
                  <td>{x.role === 'admin' ? <Badge tone="blue">Yönetici</Badge> : 'Satışçı'}</td>
                  <td>{x.active ? <Badge tone="green">Aktif</Badge> : <Badge>Devre dışı</Badge>}</td>
                  <td className="n">{x.customers}</td><td className="n">{x.visits}</td>
                  <td>{x.last_login_at ? relDays(x.last_login_at) : 'hiç'}</td>
                  <td><div className="row-actions">
                    <button className="btn xs ic" onClick={() => resetPw(x)} title="Şifre sıfırla" aria-label="Şifre sıfırla"><KeyRound size={13} /></button>
                    <button className="btn xs ic" onClick={() => act(() => api(`/api/platform/tenants/${t.id}/users/${x.id}`, { active: !x.active }, 'PATCH'))}
                      title={x.active ? 'Devre dışı bırak' : 'Aktifleştir'} aria-label={x.active ? 'Devre dışı bırak' : 'Aktifleştir'}>{x.active ? <PowerOff size={13} /> : <Power size={13} />}</button>
                    <button className="btn xs ic danger" onClick={() => setDelUser(x)} title="Kalıcı olarak sil" aria-label="Kalıcı olarak sil"><Trash2 size={13} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="cols two">
        <Terminal log={data.log} title={`grep "${t.slug}" audit.log`} />
        <div className="stack">
          <section className="card">
            <h3>Firma bilgileri</h3>
            <div className="kv wide">
              <span>Paket</span><b>{t.plan || '—'}</b>
              <span>Yetkili</span><b>{t.contact_name || '—'}</b>
              <span>E-posta</span><b>{t.contact_email || '—'}</b>
              <span>Telefon</span><b>{t.contact_phone || '—'}</b>
              <span>Notlar</span><b className="pre">{t.notes || '—'}</b>
            </div>
          </section>
          <details className="card cfg">
            <summary><Braces size={14} /> tenant.json <span className="muted small">(ham kayıt)</span></summary>
            <pre className="json">{JSON.stringify({ ...t, usage: u }, null, 2)}</pre>
          </details>
        </div>
      </div>

      <section className="card danger-zone">
        <h3>Tehlikeli bölge</h3>
        <p className="muted">Firmayı silmek, <b>{t.db_name}</b> veritabanını ve tüm kullanıcı hesaplarını <b>kalıcı olarak</b> kaldırır. Önce yedek indirmeniz önerilir.</p>
        <button className="btn danger" onClick={() => setDeleting(true)}><Trash2 size={15} /> Firmayı sil</button>
      </section>

      {editing && <EditTenant t={t} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      {adding && <AddAdmin t={t} onClose={() => setAdding(false)} onCreated={(c) => { setAdding(false); setCreds(c); reload(); }} />}
      {deleting && <DeleteTenant t={t} onClose={() => setDeleting(false)} />}
      {delUser && <DeleteUserModal user={delUser} candidates={users.filter((x) => x.active)} defaultTarget={users.find((x) => x.role === 'admin' && x.id !== delUser.id && x.active)?.id}
        endpoint={`/api/platform/tenants/${t.id}/users/${delUser.id}/delete`} onClose={() => setDelUser(null)} onDeleted={(m) => { setDelUser(null); setMsg(m); reload(); }} />}
      {creds && <Credentials title="Giriş bilgileri" who={creds.who} email={creds.email} password={creds.password} onClose={() => setCreds(null)} />}
    </div>
  );
}

function EditTenant({ t, onClose, onSaved }: { t: Tenant; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ name: t.name, plan: t.plan || '', maxUsers: t.max_users ? String(t.max_users) : '', contactName: t.contact_name || '', contactEmail: t.contact_email || '', contactPhone: t.contact_phone || '', notes: t.notes || '' });
  const [err, setErr] = useState('');
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api(`/api/platform/tenants/${t.id}`, v, 'PATCH'); onSaved(); } catch (x: any) { setErr(x.message); }
  };
  return (
    <Modal title="Firmayı düzenle" onClose={onClose} footer={<><span className="grow" /><button className="btn ghost" onClick={onClose}>Vazgeç</button><button form="edit-tenant" className="btn primary">Kaydet</button></>}>
      <form id="edit-tenant" className="grid" onSubmit={submit}>
        <Field label="Firma adı (uygulamada görünür)" full><input value={v.name} onChange={set('name')} /></Field>
        <Field label="Paket"><input value={v.plan} onChange={set('plan')} /></Field>
        <Field label="Kullanıcı limiti (boş = sınırsız)"><input type="number" min="1" value={v.maxUsers} onChange={set('maxUsers')} /></Field>
        <Field label="Yetkili"><input value={v.contactName} onChange={set('contactName')} /></Field>
        <Field label="E-posta"><input value={v.contactEmail} onChange={set('contactEmail')} /></Field>
        <Field label="Telefon"><input value={v.contactPhone} onChange={set('contactPhone')} /></Field>
        <Field label="Notlar" full><textarea rows={3} value={v.notes} onChange={set('notes')} /></Field>
        {err && <p className="error full">{err}</p>}
      </form>
    </Modal>
  );
}

function AddAdmin({ t, onClose, onCreated }: { t: Tenant; onClose: () => void; onCreated: (c: { who: string; email: string; password: string }) => void }) {
  const [v, setV] = useState({ name: '', email: '', role: 'admin', password: genPassword() });
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api(`/api/platform/tenants/${t.id}/users`, v); onCreated({ who: v.name, email: v.email.trim().toLowerCase(), password: v.password }); }
    catch (x: any) { setErr(x.message); }
  };
  return (
    <Modal title={`${t.name} · kullanıcı ekle`} onClose={onClose} footer={<><span className="grow" /><button className="btn ghost" onClick={onClose}>Vazgeç</button><button form="add-admin" className="btn primary">Ekle</button></>}>
      <form id="add-admin" className="grid" onSubmit={submit}>
        <Field label="Ad soyad *"><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></Field>
        <Field label="E-posta *"><input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field label="Yetki"><Select value={v.role} onChange={(x) => setV({ ...v, role: x })} options={{ admin: 'Firma yöneticisi', rep: 'Satışçı' }} /></Field>
        <Field label="İlk şifre"><input value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} className="mono" /></Field>
        <p className="muted small full">Normalde satışçıları firma yöneticisi kendisi ekler; buradan yapılan ekleme kullanıcı limitine takılmaz.</p>
        {err && <p className="error full">{err}</p>}
      </form>
    </Modal>
  );
}

function DeleteTenant({ t, onClose }: { t: Tenant; onClose: () => void }) {
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await api(`/api/platform/tenants/${t.id}/delete`, { confirm, password }); location.hash = '/firmalar'; }
    catch (x: any) { setErr(x.message); setBusy(false); }
  };
  return (
    <Modal title="Firmayı kalıcı olarak sil" onClose={onClose}
      footer={<><span className="grow" /><button className="btn ghost" onClick={onClose}>Vazgeç</button><button form="del-tenant" className="btn danger" disabled={busy || confirm !== t.slug || !password}><Trash2 size={15} /> Kalıcı olarak sil</button></>}>
      <form id="del-tenant" className="grid" onSubmit={submit}>
        <p className="full"><b>{t.name}</b> firmasının veritabanı (<span className="mono">{t.db_name}</span>), tüm kayıtları ve {''}kullanıcı hesapları silinecek. <b>Bu işlem geri alınamaz.</b></p>
        <Field label={`Onaylamak için firma kodunu yazın: ${t.slug}`} full><input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mono" autoFocus /></Field>
        <Field label="Platform şifreniz" full><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        {err && <p className="error full">{err}</p>}
      </form>
    </Modal>
  );
}
