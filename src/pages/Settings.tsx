import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw, LogOut, KeyRound, Download, Upload, FileSpreadsheet, Smartphone, UserRound, DatabaseZap } from 'lucide-react';
import { db, exportAll, importBackup, readLegacyData, deleteLegacyData, today } from '../db';
import { useAuth } from '../auth';
import { api } from '../api';
import { syncNow, useSyncState } from '../sync';
import { VISIT_KINDS, QUOTE_STATUS, PROJECT_STAGES, BARTER_STATUS, CUSTOMER_STATUS } from '../constants';
import { Field } from '../components/ui';

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Excel (TR) friendly CSV: UTF-8 BOM, ";" separator, comma decimals
function csv(headers: string[], rows: (string | number | undefined)[][]) {
  const cell = (v: string | number | undefined) => {
    if (v == null) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
}

async function exportExcel(kind: string) {
  const customers = await db.customers.toArray();
  const cname = new Map(customers.map((c) => [c.id, c.name]));
  const d = today();
  if (kind === 'customers') {
    const visits = await db.visits.toArray();
    const cnt = (id?: string) => visits.filter((v) => v.customerId === id).length;
    download(`musteriler-${d}.csv`, csv(
      ['Firma', 'Yetkili', 'Grup', 'Durum', 'Telefon', 'Telefon 2', 'E-posta', 'İl', 'İlçe', 'Adres', 'Görüşme sayısı', 'Notlar'],
      customers.map((c) => [c.name, c.contact, c.group, CUSTOMER_STATUS[c.status || ''], c.phone, c.phone2, c.email, c.city, c.district, c.address, cnt(c.id), c.notes])
    ), 'text/csv');
  } else if (kind === 'visits') {
    const rows = (await db.visits.toArray()).sort((a, b) => a.date.localeCompare(b.date));
    download(`gorusmeler-${d}.csv`, csv(
      ['Tarih', 'Müşteri', 'Tür', 'İl', 'İlçe', 'Konu', 'Konuşulanlar', 'Takip tarihi'],
      rows.map((v) => [v.date, cname.get(v.customerId), VISIT_KINDS[v.kind], v.city, v.district, v.subject, v.notes, v.nextDate])
    ), 'text/csv');
  } else if (kind === 'quotes') {
    const rows = (await db.quotes.toArray()).sort((a, b) => a.date.localeCompare(b.date));
    download(`teklifler-${d}.csv`, csv(
      ['Tarih', 'Müşteri', 'Ürün', 'Ölçü', 'Miktar', 'Birim', 'Birim fiyat', 'Para birimi', 'Vade', 'Durum', 'Tutmama nedeni', 'Rakip fiyat', 'Açıklama', 'Notlar'],
      rows.map((q) => [q.date, cname.get(q.customerId), q.product, q.spec, q.quantity, q.unit, q.price, q.currency, q.paymentTerm, QUOTE_STATUS[q.status], q.lostReason, q.competitorPrice, q.lostNote, q.notes])
    ), 'text/csv');
  } else if (kind === 'projects') {
    const rows = await db.projects.toArray();
    download(`projeler-${d}.csv`, csv(
      ['Proje', 'Müşteri', 'Müteahhit', 'Aşama', 'İl', 'İlçe', 'Tahmini ton', 'Başlangıç', 'Notlar'],
      rows.map((p) => [p.name, p.customerId ? cname.get(p.customerId) : '', p.contractor, PROJECT_STAGES[p.stage], p.city, p.district, p.tonnage, p.startDate, p.notes])
    ), 'text/csv');
  } else if (kind === 'barters') {
    const rows = await db.barters.toArray();
    download(`barter-${d}.csv`, csv(
      ['Tarih', 'Müşteri', 'Tür', 'Teklif edilen', 'Değer (TL)', 'İstenen ürün', 'Miktar', 'Durum', 'Notlar'],
      rows.map((b) => [b.date, cname.get(b.customerId), b.offerType, b.offered, b.offeredValue, b.wanted, b.quantity, BARTER_STATUS[b.status], b.notes])
    ), 'text/csv');
  }
}

export default function Settings() {
  const { user, logout } = useAuth();
  const sync = useSyncState();
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [legacy, setLegacy] = useState<{ data: any; count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', again: '' });
  useEffect(() => { readLegacyData().then(setLegacy); }, []);

  const backup = async () => {
    download(`saha-crm-yedek-${today()}.json`, JSON.stringify(await exportAll()), 'application/json');
    setMsg({ ok: true, text: 'Yedek dosyası indirildi.' });
  };
  const restore = async (file?: File) => {
    if (!file) return;
    if (!confirm('Yedekteki kayıtlar hesabınıza eklenecek (mevcut kayıtlarınız silinmez). Devam edilsin mi?')) return;
    setBusy(true);
    try { const n = await importBackup(JSON.parse(await file.text())); setMsg({ ok: true, text: `${n} kayıt hesabınıza aktarıldı.` }); }
    catch (e: any) { setMsg({ ok: false, text: 'Hata: ' + (e?.message || e) }); }
    finally { setBusy(false); }
  };
  const migrateLegacy = async () => {
    if (!legacy) return;
    setBusy(true);
    try {
      const n = await importBackup(legacy.data);
      await deleteLegacyData();
      setLegacy(null);
      setMsg({ ok: true, text: `${n} eski kayıt hesabınıza aktarıldı ve sunucuya gönderiliyor.` });
    } catch (e: any) { setMsg({ ok: false, text: 'Hata: ' + (e?.message || e) }); }
    finally { setBusy(false); }
  };
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.again) return setMsg({ ok: false, text: 'Yeni şifreler aynı değil.' });
    try {
      await api('/api/me/password', { current: pw.current, next: pw.next });
      setPw({ current: '', next: '', again: '' });
      setMsg({ ok: true, text: 'Şifreniz değiştirildi. Diğer cihazlarda yeniden giriş yapmanız gerekecek.' });
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
  };
  const doLogout = async () => {
    if (pending > 0 && !confirm(`${pending} değişiklik henüz sunucuya gönderilmedi. Bu cihazda saklı kalır ve tekrar giriş yaptığınızda gönderilir. Çıkış yapılsın mı?`)) return;
    await logout();
  };

  return (
    <div className="page narrow">
      <div className="page-head"><h1>Ayarlar</h1></div>
      {msg && <div className={msg.ok ? 'notice' : 'notice bad'}>{msg.text}</div>}

      {legacy && (
        <section className="card highlight">
          <h3><DatabaseZap size={14} /> Bu cihazda hesap öncesi kayıtlar var</h3>
          <p className="muted">Hesaplara geçmeden önce bu cihaza girilmiş <b>{legacy.count}</b> kayıt bulundu. Hesabınıza aktarırsanız sunucuya yedeklenir ve diğer cihazlarınızda da görünür.</p>
          <div className="actions"><button className="btn primary" disabled={busy} onClick={migrateLegacy}>Hesabıma aktar</button></div>
        </section>
      )}

      <section className="card">
        <h3><UserRound size={14} /> Hesap</h3>
        <div className="kv">
          <span>Ad soyad</span><b>{user?.name}</b>
          <span>E-posta</span><b>{user?.email}</b>
          <span>Yetki</span><b>{user?.role === 'admin' ? 'Yönetici' : 'Satış temsilcisi'}</b>
        </div>
        <div className="actions"><button className="btn" onClick={doLogout}><LogOut size={15} /> Çıkış yap</button></div>
      </section>

      <section className="card">
        <h3><KeyRound size={14} /> Şifre değiştir</h3>
        <form className="grid" onSubmit={changePassword}>
          <Field label="Mevcut şifre" full><input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="Yeni şifre (en az 8 karakter)"><input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <Field label="Yeni şifre (tekrar)"><input type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></Field>
          <div className="full"><button className="btn primary" disabled={!pw.current || pw.next.length < 8}>Şifreyi değiştir</button></div>
        </form>
      </section>

      <section className="card">
        <h3><RefreshCw size={14} /> Eşitleme</h3>
        <p className="muted">
          Kayıtlar önce bu cihaza yazılır, internet olduğunda sunucuyla otomatik eşitlenir. Sahada internet yokken de çalışabilirsiniz.
        </p>
        <div className="kv">
          <span>Durum</span><b>{sync.status === 'syncing' ? 'Eşitleniyor…' : sync.status === 'offline' ? 'Çevrimdışı' : sync.status === 'error' ? 'Hata: ' + sync.error : 'Güncel'}</b>
          <span>Bekleyen değişiklik</span><b>{pending}</b>
          <span>Son eşitleme</span><b>{sync.lastSync ? new Date(sync.lastSync).toLocaleString('tr-TR') : '—'}</b>
        </div>
        <div className="actions"><button className="btn" onClick={() => syncNow(true)}><RefreshCw size={15} /> Şimdi eşitle</button></div>
      </section>

      <section className="card">
        <h3><FileSpreadsheet size={14} /> Excel’e aktar</h3>
        <p className="muted">Excel’de doğrudan açılan dosyalar (Türkçe karakterli, noktalı virgüllü CSV).</p>
        <div className="actions">
          <button className="btn" onClick={() => exportExcel('customers')}>Müşteriler</button>
          <button className="btn" onClick={() => exportExcel('visits')}>Görüşmeler</button>
          <button className="btn" onClick={() => exportExcel('quotes')}>Teklifler</button>
          <button className="btn" onClick={() => exportExcel('projects')}>Projeler</button>
          <button className="btn" onClick={() => exportExcel('barters')}>Barter</button>
        </div>
      </section>

      <section className="card">
        <h3><Download size={14} /> Yedek dosyası</h3>
        <p className="muted">Kayıtlarınız sunucuda saklanıyor. İsterseniz ayrıca bir kopyasını dosya olarak indirebilir veya eski bir yedek dosyasını hesabınıza aktarabilirsiniz.</p>
        <div className="actions">
          <button className="btn" onClick={backup}><Download size={15} /> Yedek indir</button>
          <label className="btn"><Upload size={15} /> Yedek dosyasını aktar<input type="file" accept="application/json,.json" hidden disabled={busy} onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ''; }} /></label>
        </div>
      </section>

      <section className="card">
        <h3><Smartphone size={14} /> Telefona / tablete kurma</h3>
        <ul className="muted tight">
          <li><b>iPhone / iPad (Safari):</b> Paylaş → “Ana Ekrana Ekle”.</li>
          <li><b>Android (Chrome):</b> ⋮ menü → “Uygulamayı yükle”.</li>
          <li><b>Bilgisayar (Chrome/Edge):</b> Adres çubuğundaki yükle simgesi.</li>
        </ul>
      </section>
    </div>
  );
}
