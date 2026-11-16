import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Download, UserPlus, KeyRound, Search, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Badge, Chips, Empty, Field, Modal, Select } from '../components/ui';
import { DeleteUserModal } from '../components/DeleteUserModal';
import { Bar } from './Dashboard';
import {
  VISIT_KINDS, QUOTE_STATUS, PROJECT_STAGES, BARTER_STATUS, CUSTOMER_STATUS
} from '../constants';
import { date, money, num, relDays } from '../format';
import { Tip } from '../components/Tip';

type Tab = 'ozet' | 'kayitlar' | 'kullanicilar';
type AdminUser = {
  id: string; email: string; name: string; role: 'admin' | 'rep'; active: boolean; created_at: string;
  last_login_at?: string; last_sync_at?: string; customers: number; visits: number;
};

export default function Admin() {
  const [tab, setTab] = useState<Tab>('ozet');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const loadUsers = () => api<{ users: AdminUser[] }>('/api/admin/users').then((r) => setUsers(r.users)).catch(() => {});
  useEffect(() => { loadUsers(); }, []);
  return (
    <div className="page">
      <div className="page-head"><h1>Yönetim paneli</h1></div>
      <Tip id="admin">Yeni satışçıyı <b>Kullanıcılar</b> sekmesinden ekleyin; <b>Oluştur</b> butonu güvenli bir ilk şifre üretir. Satışçılar yalnızca kendi kayıtlarını görür.</Tip>
      <Chips value={tab} onChange={setTab} options={[['ozet', 'Ekip özeti'], ['kayitlar', 'Tüm kayıtlar'], ['kullanicilar', `Kullanıcılar (${users.length})`]]} />
      {tab === 'ozet' && <Overview />}
      {tab === 'kayitlar' && <Records users={users} />}
      {tab === 'kullanicilar' && <Users users={users} reload={loadUsers} />}
    </div>
  );
}

/* ---------------- shared bits ---------------- */
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function range(preset: string): { from?: string; to?: string } {
  const n = new Date();
  if (preset === 'month') return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(n) };
  if (preset === 'prev') return { from: iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: iso(new Date(n.getFullYear(), n.getMonth(), 0)) };
  if (preset === '30') return { from: iso(new Date(n.getTime() - 29 * 864e5)), to: iso(n) };
  if (preset === 'year') return { from: `${n.getFullYear()}-01-01`, to: iso(n) };
  return {};
}
const PRESETS = { month: 'Bu ay', prev: 'Geçen ay', '30': 'Son 30 gün', year: 'Bu yıl', all: 'Tüm zamanlar' };
const qs = (o: Record<string, string | undefined>) => '?' + Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
const pct = (a: number, b: number) => (b ? `%${Math.round((a / b) * 100)}` : '—');

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const run = () => { setLoading(true); setErr(''); fn().then(setData).catch((e) => setErr(e.message)).finally(() => setLoading(false)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, deps);
  return { data, err, loading, reload: run };
}

/* ---------------- overview ---------------- */
type Rep = {
  id: string; name: string; role: string; active: boolean; last_sync_at?: string; customers: number; active_customers: number;
  visits: number; field_visits: number; incoming: number; quotes: number; won: number; lost: number; pending: number;
  open_projects: number; barters: number; last_visit?: string;
};
type OverviewData = { reps: Rep[]; lostReasons: { reason: string; n: number }[]; products: { product: string; n: number; won: number; lost: number }[]; cities: { city: string; n: number }[] };

function Overview() {
  const [preset, setPreset] = useState('month');
  const r = range(preset);
  const { data, err, loading, reload } = useLoad(() => api<OverviewData>('/api/admin/overview' + qs(r)), [preset]);
  const reps = (data?.reps || []).filter((x) => x.active || x.customers > 0);
  const sum = (k: keyof Rep) => reps.reduce((a, x) => a + (Number(x[k]) || 0), 0);
  return (
    <>
      <div className="filters">
        <Select value={preset} onChange={setPreset} options={PRESETS} />
        <button className="btn" onClick={reload} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Yenile</button>
      </div>
      {err && <div className="notice bad">{err}</div>}
      {data && (
        <>
          <div className="stats">
            <div className="stat"><span>Görüşme</span><b>{sum('visits')}</b><small>{sum('field_visits')} saha · {sum('incoming')} gelen</small></div>
            <div className="stat"><span>Verilen teklif</span><b>{sum('quotes')}</b><small>{sum('pending')} beklemede (toplam)</small></div>
            <div className="stat"><span>Tutma oranı</span><b>{pct(sum('won'), sum('won') + sum('lost'))}</b><small>{sum('won')} tuttu · {sum('lost')} tutmadı</small></div>
            <div className="stat"><span>Müşteri</span><b>{sum('customers')}</b><small>{sum('active_customers')} aktif · {sum('open_projects')} açık proje</small></div>
          </div>
          <section className="card flush">
            <h3 className="pad-h">Satışçı performansı <small className="muted">({PRESETS[preset as keyof typeof PRESETS]})</small></h3>
            <div className="table-wrap">
              <table className="table">
                <thead><tr>
                  <th>Satışçı</th><th className="n">Müşteri</th><th className="n">Görüşme</th><th className="n">Saha</th><th className="n">Gelen</th>
                  <th className="n">Teklif</th><th className="n">Tuttu</th><th className="n">Tutmadı</th><th className="n">Oran</th>
                  <th className="n">Bekleyen</th><th className="n">Açık proje</th><th className="n">Barter</th><th>Son ziyaret</th><th>Son eşitleme</th>
                </tr></thead>
                <tbody>
                  {reps.map((x) => (
                    <tr key={x.id} className={x.active ? '' : 'dim'}>
                      <td><b>{x.name}</b>{x.role === 'admin' && <> <Badge tone="blue">Yönetici</Badge></>}{!x.active && <> <Badge>Pasif</Badge></>}</td>
                      <td className="n">{x.customers}</td><td className="n">{x.visits}</td><td className="n">{x.field_visits}</td><td className="n">{x.incoming}</td>
                      <td className="n">{x.quotes}</td><td className="n green">{x.won}</td><td className="n red">{x.lost}</td><td className="n">{pct(x.won, x.won + x.lost)}</td>
                      <td className="n">{x.pending}</td><td className="n">{x.open_projects}</td><td className="n">{x.barters}</td>
                      <td>{x.last_visit ? `${date(x.last_visit)} (${relDays(x.last_visit)})` : '—'}</td>
                      <td>{x.last_sync_at ? relDays(x.last_sync_at) : 'hiç'}</td>
                    </tr>
                  ))}
                  {!reps.length && <tr><td colSpan={14} className="muted center">Henüz kullanıcı yok.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <div className="cols">
            <section className="card">
              <h3>Teklif neden tutmadı?</h3>
              {data.lostReasons.length ? <div className="bars">{data.lostReasons.map((x) => <Bar key={x.reason} label={x.reason} n={x.n} max={data.lostReasons[0].n} tone="red" />)}</div>
                : <Empty>Bu dönemde tutmayan teklif yok.</Empty>}
            </section>
            <section className="card">
              <h3>Ürünlere göre teklifler</h3>
              {data.products.length ? (
                <table className="table mini"><thead><tr><th>Ürün</th><th className="n">Teklif</th><th className="n">Tuttu</th><th className="n">Tutmadı</th></tr></thead>
                  <tbody>{data.products.map((p) => <tr key={p.product}><td>{p.product}</td><td className="n">{p.n}</td><td className="n green">{p.won}</td><td className="n red">{p.lost}</td></tr>)}</tbody></table>
              ) : <Empty>Bu dönemde teklif yok.</Empty>}
            </section>
            <section className="card">
              <h3>En çok gidilen iller</h3>
              {data.cities.length ? <div className="bars">{data.cities.map((c) => <Bar key={c.city} label={c.city} n={c.n} max={data.cities[0].n} />)}</div>
                : <Empty>Bu dönemde saha ziyareti yok.</Empty>}
            </section>
          </div>
        </>
      )}
    </>
  );
}

/* ---------------- all records ---------------- */
type Col = { h: string; v: (r: any) => React.ReactNode; csv?: (r: any) => string | number | undefined; n?: boolean };
const place = (r: any) => [r.district, r.city].filter(Boolean).join(', ');
const COLS: Record<string, Col[]> = {
  customers: [
    { h: 'Firma', v: (r) => <b>{r.name}</b>, csv: (r) => r.name }, { h: 'Yetkili', v: (r) => r.contact }, { h: 'Grup', v: (r) => r.group },
    { h: 'Durum', v: (r) => CUSTOMER_STATUS[r.status] || r.status }, { h: 'Telefon', v: (r) => r.phone }, { h: 'Yer', v: place },
    { h: 'Satışçı', v: (r) => r.ownerName }
  ],
  visits: [
    { h: 'Tarih', v: (r) => date(r.date), csv: (r) => r.date }, { h: 'Müşteri', v: (r) => <b>{r.customerName}</b>, csv: (r) => r.customerName },
    { h: 'Tür', v: (r) => VISIT_KINDS[r.kind] }, { h: 'Konu', v: (r) => r.subject }, { h: 'Konuşulanlar', v: (r) => <span className="clip">{r.notes}</span>, csv: (r) => r.notes },
    { h: 'Yer', v: place }, { h: 'Takip', v: (r) => date(r.nextDate), csv: (r) => r.nextDate }, { h: 'Satışçı', v: (r) => r.ownerName }
  ],
  quotes: [
    { h: 'Tarih', v: (r) => date(r.date), csv: (r) => r.date }, { h: 'Müşteri', v: (r) => <b>{r.customerName}</b>, csv: (r) => r.customerName },
    { h: 'Ürün', v: (r) => [r.product, r.spec].filter(Boolean).join(' · ') }, { h: 'Miktar', n: true, v: (r) => (r.quantity ? `${num(r.quantity)} ${r.unit || ''}` : ''), csv: (r) => r.quantity },
    { h: 'Birim fiyat', n: true, v: (r) => money(r.price, r.currency), csv: (r) => r.price }, { h: 'Vade', v: (r) => r.paymentTerm },
    { h: 'Durum', v: (r) => <Badge tone={r.status === 'tuttu' ? 'green' : r.status === 'tutmadi' ? 'red' : 'amber'}>{QUOTE_STATUS[r.status]}</Badge>, csv: (r) => QUOTE_STATUS[r.status] },
    { h: 'Tutmama nedeni', v: (r) => r.lostReason }, { h: 'Rakip fiyat', n: true, v: (r) => money(r.competitorPrice, r.currency), csv: (r) => r.competitorPrice },
    { h: 'Satışçı', v: (r) => r.ownerName }
  ],
  projects: [
    { h: 'Proje', v: (r) => <b>{r.name}</b>, csv: (r) => r.name }, { h: 'Müşteri', v: (r) => r.customerName }, { h: 'Müteahhit', v: (r) => r.contractor },
    { h: 'Aşama', v: (r) => PROJECT_STAGES[r.stage] }, { h: 'Ton', n: true, v: (r) => num(r.tonnage), csv: (r) => r.tonnage }, { h: 'Yer', v: place },
    { h: 'Başlangıç', v: (r) => date(r.startDate), csv: (r) => r.startDate }, { h: 'Satışçı', v: (r) => r.ownerName }
  ],
  barters: [
    { h: 'Tarih', v: (r) => date(r.date), csv: (r) => r.date }, { h: 'Müşteri', v: (r) => <b>{r.customerName}</b>, csv: (r) => r.customerName },
    { h: 'Tür', v: (r) => r.offerType }, { h: 'Teklif edilen', v: (r) => r.offered }, { h: 'Değer', n: true, v: (r) => money(r.offeredValue), csv: (r) => r.offeredValue },
    { h: 'İstenen', v: (r) => [r.wanted, r.quantity].filter(Boolean).join(' · ') }, { h: 'Durum', v: (r) => BARTER_STATUS[r.status] },
    { h: 'Satışçı', v: (r) => r.ownerName }
  ]
};
const TABLE_LABELS = { customers: 'Müşteriler', visits: 'Görüşmeler', quotes: 'Fiyat teklifleri', projects: 'Projeler', barters: 'Barter' };

const LABELS: Record<string, string> = {
  name: 'Ad', contact: 'Yetkili', phone: 'Telefon', phone2: '2. telefon', email: 'E-posta', city: 'İl', district: 'İlçe', address: 'Adres',
  group: 'Grup', status: 'Durum', notes: 'Notlar', date: 'Tarih', kind: 'Tür', subject: 'Konu', nextDate: 'Takip tarihi', product: 'Ürün',
  spec: 'Ölçü / kalite', quantity: 'Miktar', unit: 'Birim', price: 'Birim fiyat', currency: 'Para birimi', paymentTerm: 'Vade',
  lostReason: 'Tutmama nedeni', lostNote: 'Açıklama', competitorPrice: 'Rakip fiyat', stage: 'Aşama', tonnage: 'Tahmini ton',
  contractor: 'Müteahhit', startDate: 'Başlangıç', offerType: 'Teklif türü', offered: 'Teklif edilen', offeredValue: 'Değer',
  wanted: 'İstenen ürün', customerName: 'Müşteri', ownerName: 'Satışçı', createdAt: 'Oluşturulma', updatedAt: 'Son değişiklik'
};
const HIDDEN = new Set(['id', 'customerId', 'ownerId']);

function csvDownload(name: string, cols: Col[], rows: any[]) {
  const cell = (v: unknown) => {
    if (v == null) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const txt = (r: any, c: Col) => (c.csv ? c.csv(r) : (() => { const x = c.v(r); return typeof x === 'string' || typeof x === 'number' ? x : ''; })());
  const body = [cols.map((c) => c.h), ...rows.map((r) => cols.map((c) => txt(r, c)))].map((r) => r.map(cell).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Records({ users }: { users: AdminUser[] }) {
  const [table, setTable] = useState('visits');
  const [owner, setOwner] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [preset, setPreset] = useState('all');
  const [detail, setDetail] = useState<any>(null);
  const r = range(preset);
  const { data, err, loading } = useLoad(
    () => api<{ rows: any[] }>(`/api/admin/records/${table}` + qs({ owner, q: query, ...r, limit: '1000' })), [table, owner, query, preset]);
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 350); return () => clearTimeout(t); }, [q]);
  const cols = COLS[table];
  const rows = data?.rows || [];
  const ownerOptions = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.name])), [users]);
  return (
    <>
      <div className="filters">
        <Select value={table} onChange={setTable} options={TABLE_LABELS} />
        <Select value={owner} onChange={setOwner} options={ownerOptions} empty="Tüm satışçılar" />
        {table !== 'customers' && <Select value={preset} onChange={setPreset} options={PRESETS} />}
        <div className="search-box"><Search size={15} /><input className="search" placeholder="Ara…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className="btn" disabled={!rows.length} onClick={() => csvDownload(`${table}-${new Date().toISOString().slice(0, 10)}.csv`, cols, rows)}><Download size={15} /> Excel</button>
      </div>
      {err && <div className="notice bad">{err}</div>}
      <section className="card flush">
        <div className="table-head muted">{loading ? 'Yükleniyor…' : `${rows.length} kayıt${rows.length === 1000 ? ' (ilk 1000)' : ''}`}</div>
        <div className="table-wrap">
          <table className="table clickable">
            <thead><tr>{cols.map((c) => <th key={c.h} className={c.n ? 'n' : ''}>{c.h}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ownerId + row.id} onClick={() => setDetail(row)}>
                  {cols.map((c) => <td key={c.h} className={c.n ? 'n' : ''}>{c.v(row)}</td>)}
                </tr>
              ))}
              {!loading && !rows.length && <tr><td colSpan={cols.length} className="muted center">Kayıt bulunamadı.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {detail && (
        <Modal title={TABLE_LABELS[table as keyof typeof TABLE_LABELS] + ' · ayrıntı'} onClose={() => setDetail(null)}>
          <div className="kv wide">
            {Object.entries(detail).filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== undefined && v !== '').map(([k, v]) => (
              <Fragment2 key={k} k={LABELS[k] || k} v={fmtField(k, v)} />
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
const Fragment2 = ({ k, v }: { k: string; v: string }) => <><span>{k}</span><b className="pre">{v}</b></>;
function fmtField(k: string, v: unknown): string {
  if (k === 'kind') return VISIT_KINDS[v as string] || String(v);
  if (k === 'stage') return PROJECT_STAGES[v as string] || String(v);
  if (k === 'status') return QUOTE_STATUS[v as string] || BARTER_STATUS[v as string] || CUSTOMER_STATUS[v as string] || String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return date(String(v));
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(v))) return new Date(String(v)).toLocaleString('tr-TR');
  if (typeof v === 'number') return num(v);
  return String(v);
}

/* ---------------- users ---------------- */
function genPassword() {
  const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint8Array(12))].map((x) => a[x % a.length]).join('');
}

function Users({ users, reload }: { users: AdminUser[]; reload: () => void }) {
  const { user: me } = useAuth();
  const [edit, setEdit] = useState<Partial<AdminUser> | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [msg, setMsg] = useState('');
  return (
    <>
      {msg && <div className="notice">{msg}</div>}
      <div className="filters"><span className="grow" /><button className="btn primary" onClick={() => setEdit({ role: 'rep', active: true })}><UserPlus size={16} /> Yeni kullanıcı</button></div>
      <section className="card flush">
        <div className="table-wrap">
          <table className="table clickable">
            <thead><tr><th>Ad soyad</th><th>E-posta</th><th>Yetki</th><th>Durum</th><th className="n">Müşteri</th><th className="n">Görüşme</th><th>Son giriş</th><th>Son eşitleme</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.active ? '' : 'dim'} onClick={() => setEdit(u)}>
                  <td><b>{u.name}</b>{u.id === me?.id && <span className="muted"> (siz)</span>}</td>
                  <td>{u.email}</td>
                  <td>{u.role === 'admin' ? <Badge tone="blue">Yönetici</Badge> : 'Satış temsilcisi'}</td>
                  <td>{u.active ? <Badge tone="green">Aktif</Badge> : <Badge>Devre dışı</Badge>}</td>
                  <td className="n">{u.customers}</td><td className="n">{u.visits}</td>
                  <td>{u.last_login_at ? relDays(u.last_login_at) : 'hiç'}</td>
                  <td>{u.last_sync_at ? relDays(u.last_sync_at) : 'hiç'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="muted small">Devre dışı bırakılan kullanıcı tüm cihazlarda oturumdan çıkarılır; kayıtları silinmez, raporlarda görünmeye devam eder. Kalıcı silmek için kullanıcıya tıklayıp <b>Sil</b>’i seçin; kayıtlarını başka bir kullanıcıya aktarabilirsiniz.</p>
      {edit && <UserForm initial={edit} isSelf={edit.id === me?.id} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }}
        onDelete={() => { setDeleting(edit as AdminUser); setEdit(null); }} />}
      {deleting && <DeleteUserModal user={deleting} candidates={users} defaultTarget={me?.id} endpoint={`/api/admin/users/${deleting.id}/delete`}
        onClose={() => setDeleting(null)} onDeleted={(m) => { setDeleting(null); setMsg(m); reload(); }} />}
    </>
  );
}

function UserForm({ initial, isSelf, onClose, onSaved, onDelete }: { initial: Partial<AdminUser>; isSelf: boolean; onClose: () => void; onSaved: () => void; onDelete: () => void }) {
  const isNew = !initial.id;
  const [v, setV] = useState({ name: initial.name || '', email: initial.email || '', role: initial.role || 'rep', active: initial.active ?? true, password: '' });
  const [err, setErr] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      if (isNew) await api('/api/admin/users', v);
      else await api(`/api/admin/users/${initial.id}`, { name: v.name, email: v.email, role: v.role, active: v.active, ...(v.password ? { password: v.password } : {}) }, 'PATCH');
      if (v.password) setDone(v.password); else onSaved();
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  if (done) {
    return (
      <Modal title="Giriş bilgileri" onClose={onSaved} footer={<><span className="grow" /><button className="btn primary" onClick={onSaved}>Tamam</button></>}>
        <p>Bu bilgileri <b>{v.name}</b> ile paylaşın. İlk girişten sonra Ayarlar’dan kendi şifresini belirlemesini isteyin.</p>
        <div className="kv"><span>Adres</span><b>{location.origin}</b><span>E-posta</span><b>{v.email}</b><span>Şifre</span><b className="mono">{done}</b></div>
      </Modal>
    );
  }
  return (
    <Modal title={isNew ? 'Yeni kullanıcı' : 'Kullanıcıyı düzenle'} onClose={onClose}
      footer={<>{!isNew && !isSelf && <button type="button" className="btn danger ghost" onClick={onDelete}><Trash2 size={15} /> Sil</button>}<span className="grow" /><button type="button" className="btn ghost" onClick={onClose}>Vazgeç</button><button form="user-form" className="btn primary" disabled={busy}>Kaydet</button></>}>
      <form id="user-form" className="grid" onSubmit={submit}>
        <Field label="Ad soyad *"><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></Field>
        <Field label="E-posta *"><input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field label="Yetki">
          <Select value={v.role} onChange={(x) => setV({ ...v, role: x as 'admin' | 'rep' })} options={{ rep: 'Satış temsilcisi', admin: 'Yönetici (tüm kayıtları görür)' }} />
        </Field>
        {!isNew && (
          <Field label="Durum">
            <Select value={v.active ? '1' : '0'} onChange={(x) => setV({ ...v, active: x === '1' })} options={{ '1': 'Aktif', '0': 'Devre dışı' }} />
          </Field>
        )}
        <Field label={isNew ? 'İlk şifre * (en az 8 karakter)' : 'Yeni şifre (değiştirmek için doldurun)'} full>
          <div className="inline">
            <input value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} autoComplete="new-password" className="mono" />
            <button type="button" className="btn" onClick={() => setV({ ...v, password: genPassword() })}><KeyRound size={15} /> Oluştur</button>
          </div>
        </Field>
        {isSelf && <p className="muted small full">Kendi yetkinizi kaldıramaz veya hesabınızı devre dışı bırakamazsınız.</p>}
        {err && <p className="error full">{err}</p>}
      </form>
    </Modal>
  );
}
