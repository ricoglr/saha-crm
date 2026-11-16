import { useEffect, useState } from 'react';
import { LayoutDashboard, Building2, ShieldCheck, ScrollText, KeyRound, LogOut, LogIn, Menu, ExternalLink, type LucideIcon } from 'lucide-react';
import { api } from '../api';
import { type Admin, useHashRoute } from './util';
import Overview from './Overview';
import { TenantList } from './Tenants';
import TenantDetail from './TenantDetail';
import { Admins, Audit, Account } from './Misc';

const NAV: [string, LucideIcon, string][] = [
  ['/', LayoutDashboard, 'Genel bakış'],
  ['/firmalar', Building2, 'Firmalar'],
  ['/yoneticiler', ShieldCheck, 'Platform yöneticileri'],
  ['/kayit', ScrollText, 'İşlem kaydı'],
  ['/hesap', KeyRound, 'Hesabım']
];

function Login({ onLogin }: { onLogin: (a: Admin) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { onLogin((await api<{ admin: Admin }>('/api/platform/auth/login', { email: email.trim(), password })).admin); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><img src="/icon.svg" alt="" /><div><b>Saha CRM</b><small>Platform konsolu</small></div></div>
        <h1>Platform yöneticisi girişi</h1>
        <label className="field"><span>E-posta</span><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required /></label>
        <label className="field"><span>Şifre</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {err && <p className="error">{err}</p>}
        <button className="btn primary block" disabled={busy}><LogIn size={16} /> {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
        <p className="muted small">Bu panel yalnızca yazılım sağlayıcısı içindir. Firma kullanıcıları <a href="/">uygulamaya</a> buradan girer.</p>
      </form>
    </div>
  );
}

export default function PlatformApp() {
  const [admin, setAdmin] = useState<Admin | null | undefined>(undefined);
  const [menu, setMenu] = useState(false);
  const route = useHashRoute().split('?')[0];
  useEffect(() => {
    api<{ admin: Admin }>('/api/platform/me').then((r) => setAdmin(r.admin)).catch(() => setAdmin(null));
    const on = () => setAdmin(null);
    window.addEventListener('crm-unauthorized', on);
    return () => window.removeEventListener('crm-unauthorized', on);
  }, []);
  useEffect(() => setMenu(false), [route]);
  if (admin === undefined) return null;
  if (!admin) return <Login onLogin={setAdmin} />;
  const logout = async () => { try { await api('/api/platform/auth/logout', {}); } catch { /* ignore */ } setAdmin(null); };
  const active = (p: string) => (p === '/' ? route === '/' : route.startsWith(p) || (p === '/firmalar' && route.startsWith('/firma/')));
  const m = route.match(/^\/firma\/([^/]+)/);
  let page;
  if (m) page = <TenantDetail id={m[1]} />;
  else if (route === '/firmalar') page = <TenantList />;
  else if (route === '/yoneticiler') page = <Admins me={admin} />;
  else if (route === '/kayit') page = <Audit />;
  else if (route === '/hesap') page = <Account admin={admin} />;
  else page = <Overview />;

  return (
    <div className="app">
      <div className="p-topbar">
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Menü"><Menu size={20} /></button>
        <b>Platform konsolu</b>
      </div>
      <aside className={'sidebar' + (menu ? ' open' : '')}>
        <div className="brand"><img src="/icon.svg" alt="" /><div><b>Saha CRM</b><span className="tag">Platform</span></div></div>
        <nav>
          {NAV.map(([p, I, l]) => <a key={p} href={'#' + p} className={active(p) ? 'on' : ''}><I size={17} strokeWidth={1.8} />{l}</a>)}
          <a href="/" target="_blank" rel="noreferrer"><ExternalLink size={17} strokeWidth={1.8} />Satış uygulaması</a>
        </nav>
        <div className="side-foot">
          <div className="me">
            <div><b>{admin.name}</b><small>{admin.email}</small></div>
            <button className="icon-btn" title="Çıkış yap" onClick={logout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <main>{page}</main>
    </div>
  );
}
