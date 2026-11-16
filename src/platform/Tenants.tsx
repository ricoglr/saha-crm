import { useEffect, useState } from 'react';
import { Plus, KeyRound, Search, Copy, Check } from 'lucide-react';
import { api } from '../api';
import { Badge, Empty, Field, Modal } from '../components/primitives';
import { num, relDays } from '../format';
import { bytes, genPassword, slugify, useLoad, type Tenant } from './util';

export function StatusBadge({ s }: { s: string }) {
  return s === 'active' ? <Badge tone="green">Aktif</Badge> : <Badge tone="amber">Askıda</Badge>;
}

export function TenantList() {
  const { data, err, loading, reload } = useLoad(() => api<{ tenants: Tenant[] }>('/api/platform/tenants'), []);
  const [creating, setCreating] = useState(location.hash.includes('?yeni'));
  const [created, setCreated] = useState<{ tenant: Tenant; email: string; password: string } | null>(null);
  const [q, setQ] = useState('');
  const list = (data?.tenants || []).filter((t) => !q || (t.name + ' ' + t.slug + ' ' + (t.contact_name || '')).toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')));
  return (
    <div className="page">
      <div className="page-head">
        <h1>Firmalar <small className="muted">{data?.tenants.length ?? ''}</small></h1>
        <button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} /> Yeni firma</button>
      </div>
      {err && <div className="notice bad">{err}</div>}
      <div className="filters"><div className="search-box"><Search size={15} /><input className="search" placeholder="Firma ara…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <section className="card flush">
        <div className="table-wrap">
          <table className="table clickable">
            <thead><tr>
              <th>Firma</th><th>Kod / veritabanı</th><th>Durum</th><th>Paket</th><th className="n">Kullanıcı</th><th className="n">Müşteri</th>
              <th className="n">Görüşme</th><th className="n">Boyut</th><th>Son aktivite</th><th>Oluşturma</th>
            </tr></thead>
            <tbody>
              {list.map((t) => {
                const u = t.usage;
                return (
                  <tr key={t.id} onClick={() => { location.hash = '/firma/' + t.id; }}>
                    <td><b>{t.name}</b>{t.contact_name && <div className="muted small">{t.contact_name}</div>}</td>
                    <td><span className="mono-sm">{t.slug} · {t.db_name}</span></td>
                    <td><StatusBadge s={t.status} /></td>
                    <td>{t.plan || '—'}</td>
                    <td className="n">{u && !u.error ? `${u.active_users}${t.max_users ? ' / ' + t.max_users : ''}` : '—'}</td>
                    <td className="n">{u && !u.error ? num(u.customers) : '—'}</td>
                    <td className="n">{u && !u.error ? num(u.visits) : '—'}</td>
                    <td className="n">{bytes(u?.db_bytes)}</td>
                    <td>{u?.last_activity ? relDays(u.last_activity) : 'hiç'}</td>
                    <td>{new Date(t.created_at).toLocaleDateString('tr-TR')}</td>
                  </tr>
                );
              })}
              {!loading && !list.length && <tr><td colSpan={10}><Empty>Henüz firma yok. “Yeni firma” ile ilk müşterinizi oluşturun.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {creating && <CreateTenant onClose={() => { setCreating(false); history.replaceState(null, '', '#/firmalar'); }} onCreated={(c) => { setCreating(false); setCreated(c); reload(); }} />}
      {created && <Credentials title="Firma oluşturuldu" who={`${created.tenant.name} yöneticisi`} email={created.email} password={created.password}
        onClose={() => { setCreated(null); location.hash = '/firma/' + created.tenant.id; }} />}
    </div>
  );
}

function CreateTenant({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { tenant: Tenant; email: string; password: string }) => void }) {
  const [v, setV] = useState({ name: '', slug: '', plan: 'Başlangıç', maxUsers: '5', contactName: '', contactEmail: '', contactPhone: '', notes: '', adminName: '', adminEmail: '', adminPassword: genPassword() });
  const [slugTouched, setSlugTouched] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));
  useEffect(() => { if (!slugTouched) setV((p) => ({ ...p, slug: slugify(p.name) })); }, [v.name, slugTouched]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api<{ tenant: Tenant }>('/api/platform/tenants', {
        name: v.name, slug: v.slug, plan: v.plan, maxUsers: v.maxUsers, contactName: v.contactName || v.adminName,
        contactEmail: v.contactEmail || v.adminEmail, contactPhone: v.contactPhone, notes: v.notes,
        admin: { name: v.adminName, email: v.adminEmail, password: v.adminPassword }
      });
      onCreated({ tenant: r.tenant, email: v.adminEmail.trim().toLowerCase(), password: v.adminPassword });
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Yeni firma" onClose={onClose}
      footer={<><span className="grow" /><button className="btn ghost" onClick={onClose}>Vazgeç</button><button form="tenant-form" className="btn primary" disabled={busy}>{busy ? 'Oluşturuluyor…' : 'Firmayı oluştur'}</button></>}>
      <form id="tenant-form" className="grid" onSubmit={submit}>
        <p className="section-title full">Firma</p>
        <Field label="Firma adı *" full><input value={v.name} onChange={set('name')} placeholder="Örn. Yıldız Yapı Malzemeleri Ltd. Şti." autoFocus /></Field>
        <Field label="Firma kodu * (veritabanı adı olur)">
          <input value={v.slug} onChange={(e) => { setSlugTouched(true); set('slug')(e); }} className="mono" />
        </Field>
        <Field label="Paket"><input value={v.plan} onChange={set('plan')} list="plans" /><datalist id="plans"><option value="Başlangıç" /><option value="Profesyonel" /><option value="Kurumsal" /></datalist></Field>
        <Field label="Kullanıcı limiti (boş = sınırsız)"><input type="number" min="1" value={v.maxUsers} onChange={set('maxUsers')} /></Field>
        <Field label="Telefon"><input value={v.contactPhone} onChange={set('contactPhone')} /></Field>
        <Field label="Notlar (sözleşme, fatura vb.)" full><textarea rows={2} value={v.notes} onChange={set('notes')} /></Field>
        <p className="section-title full">Firma yöneticisi (ilk giriş hesabı)</p>
        <Field label="Ad soyad *"><input value={v.adminName} onChange={set('adminName')} /></Field>
        <Field label="E-posta *"><input type="email" value={v.adminEmail} onChange={set('adminEmail')} /></Field>
        <Field label="İlk şifre *" full>
          <div className="inline">
            <input value={v.adminPassword} onChange={set('adminPassword')} className="mono" />
            <button type="button" className="btn" onClick={() => setV((p) => ({ ...p, adminPassword: genPassword() }))}><KeyRound size={15} /> Yeni</button>
          </div>
        </Field>
        <p className="muted small full">Firma için <span className="mono">saha_t_{v.slug || '…'}</span> adlı ayrı bir veritabanı oluşturulur. Firma yöneticisi kendi satışçılarını uygulamadaki Yönetim sayfasından ekler.</p>
        {err && <p className="error full">{err}</p>}
      </form>
    </Modal>
  );
}

export function Credentials({ title, who, email, password, onClose }: { title: string; who: string; email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Saha CRM giriş bilgileri\nAdres: ${location.origin}\nE-posta: ${email}\nŞifre: ${password}\nİlk girişten sonra Ayarlar > Şifre değiştir bölümünden kendi şifrenizi belirleyin.`;
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* clipboard blocked */ } };
  return (
    <Modal title={title} onClose={onClose} footer={<><button className="btn" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Kopyalandı' : 'Bilgileri kopyala'}</button><span className="grow" /><button className="btn primary" onClick={onClose}>Tamam</button></>}>
      <p>Bu giriş bilgilerini <b>{who}</b> ile paylaşın. Şifre bir daha gösterilmez.</p>
      <div className="cred"><div className="kv wide"><span>Adres</span><b>{location.origin}</b><span>E-posta</span><b>{email}</b><span>Şifre</span><b className="mono">{password}</b></div></div>
    </Modal>
  );
}
