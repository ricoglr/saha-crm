import { useEffect, useState } from 'react';

export type Admin = { id: string; email: string; name: string };
export type Usage = { users: number; active_users: number; customers: number; visits: number; quotes: number; last_activity?: string; db_bytes: number; error?: string } | null;
export type Tenant = {
  id: string; slug: string; name: string; db_name: string; status: 'active' | 'suspended'; plan?: string; max_users?: number;
  contact_name?: string; contact_email?: string; contact_phone?: string; notes?: string; is_legacy: boolean; created_at: string; usage?: Usage;
};
export type LogEntry = { id: number; at: string; actor_email?: string; ip?: string; action: string; target?: string; details?: any };

export const ACTIONS: Record<string, string> = {
  login: 'Platforma giriş', 'tenant.create': 'Firma oluşturuldu', 'tenant.update': 'Firma bilgileri güncellendi',
  'tenant.suspend': 'Firma askıya alındı', 'tenant.activate': 'Firma aktifleştirildi', 'tenant.export': 'Yedek indirildi',
  'tenant.delete': 'Firma silindi', 'user.create': 'Firma kullanıcısı eklendi', 'user.update': 'Firma kullanıcısı güncellendi',
  'admin.create': 'Platform yöneticisi eklendi', 'admin.update': 'Platform yöneticisi güncellendi', 'admin.delete': 'Platform yöneticisi silindi',
  'user.delete': 'Firma kullanıcısı silindi', 'announcement.create': 'Duyuru oluşturuldu', 'announcement.update': 'Duyuru güncellendi',
  'announcement.delete': 'Duyuru silindi', 'password.change': 'Şifre değiştirildi'
};

export const bytes = (n?: number) => (n == null ? '—' : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const dt = (s?: string) => (s ? new Date(s).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export function genPassword(len = 14) {
  const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint8Array(len))].map((x) => a[x % a.length]).join('');
}

/** "Yıldız Yapı Ltd." -> "yildizyapi" */
export function slugify(name: string) {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u' };
  const s = name.toLocaleLowerCase('tr').replace(/[çğıiöşü]/g, (c) => map[c] || c)
    .replace(/\b(a\.?ş\.?|ltd\.?|şti\.?|sti\.?|san\.?|tic\.?|ve)\b/g, '').replace(/[^a-z0-9]/g, '');
  return (/^[a-z]/.test(s) ? s : 'f' + s).slice(0, 30);
}

export function useHashRoute() {
  const get = () => location.hash.replace(/^#/, '') || '/';
  const [r, setR] = useState(get());
  useEffect(() => {
    const on = () => { setR(get()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const run = () => { setLoading(true); setErr(''); fn().then(setData).catch((e) => setErr(e.message)).finally(() => setLoading(false)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, deps);
  return { data, err, loading, reload: run };
}
