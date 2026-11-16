import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard, Building2, ShieldCheck, ScrollText, KeyRound, LogOut, LogIn, Menu, ExternalLink, Plus, Command as Cmd,
  SunMoon, TerminalSquare, Megaphone, type LucideIcon
} from 'lucide-react';
import { api } from '../api';
import { ThemeToggle } from '../components/ThemeToggle';
import { nextTheme, setTheme, getTheme } from '../theme';
import { type Admin, type Tenant, useHashRoute } from './util';
import { ApiStatus, CommandPalette, type Command } from './ui';
import Overview from './Overview';
import { TenantList } from './Tenants';
import TenantDetail from './TenantDetail';
import { Admins, Audit, Account } from './Misc';
import Announcements from './Announcements';

const NAV: { group: string; items: [string, LucideIcon, string][] }[] = [
  { group: 'genel', items: [['/', LayoutDashboard, 'Genel bakış'], ['/firmalar', Building2, 'Firmalar'], ['/duyurular', Megaphone, 'Duyurular']] },
  { group: 'erişim', items: [['/yoneticiler', ShieldCheck, 'Yöneticiler'], ['/kayit', ScrollText, 'İşlem kaydı']] },
  { group: 'hesap', items: [['/hesap', KeyRound, 'Hesabım']] }
];
const CRUMB: Record<string, string> = { '/': 'genel-bakis', '/firmalar': 'firmalar', '/yoneticiler': 'yoneticiler', '/kayit': 'islem-kaydi', '/hesap': 'hesap', '/duyurular': 'duyurular' };

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
    <div className="p-login">
      <ThemeToggle className="icon-btn p-login-theme" />
      <form className="p-login-card" onSubmit={submit}>
        <div className="p-login-head"><TerminalSquare size={18} /><span>saha-crm</span><span className="tag">platform</span></div>
        <div className="p-login-body">
          <p className="prompt">$ auth login --role=platform-admin</p>
          <label className="field"><span>email</span><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required /></label>
          <label className="field"><span>password</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {err && <p className="error">✗ {err}</p>}
          <button className="btn primary block" disabled={busy}><LogIn size={16} /> {busy ? 'Doğrulanıyor…' : 'Giriş yap'}</button>
          <p className="muted small">Yalnızca yazılım sağlayıcısı içindir. Firma kullanıcıları <a href="/">uygulamaya</a> girer.</p>
        </div>
      </form>
    </div>
  );
}

export default function PlatformApp() {
  const [admin, setAdmin] = useState<Admin | null | undefined>(undefined);
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const route = useHashRoute().split('?')[0];

  useEffect(() => {
    api<{ admin: Admin }>('/api/platform/me').then((r) => setAdmin(r.admin)).catch(() => setAdmin(null));
    const on = () => setAdmin(null);
    window.addEventListener('crm-unauthorized', on);
    return () => window.removeEventListener('crm-unauthorized', on);
  }, []);
  useEffect(() => setMenu(false), [route]);
  useEffect(() => {
    if (!admin) return;
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((x) => !x); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [admin]);
  useEffect(() => { if (palette) api<{ tenants: Tenant[] }>('/api/platform/tenants').then((r) => setTenants(r.tenants)).catch(() => {}); }, [palette]);

  const logout = useCallback(async () => { try { await api('/api/platform/auth/logout', {}); } catch { /* ignore */ } setAdmin(null); }, []);

  if (admin === undefined) return null;
  if (!admin) return <Login onLogin={setAdmin} />;

  const active = (p: string) => (p === '/' ? route === '/' : route.startsWith(p) || (p === '/firmalar' && route.startsWith('/firma/')));
  const m = route.match(/^\/firma\/([^/]+)/);
  let page;
  if (m) page = <TenantDetail id={m[1]} />;
  else if (route === '/firmalar') page = <TenantList />;
  else if (route === '/yoneticiler') page = <Admins me={admin} />;
  else if (route === '/kayit') page = <Audit />;
  else if (route === '/hesap') page = <Account admin={admin} />;
  else if (route === '/duyurular') page = <Announcements />;
  else page = <Overview />;
  const crumbs = m ? ['firmalar', m[1].slice(0, 8)] : [CRUMB[route] || route.slice(1)];

  const go = (h: string) => () => { location.hash = h; };
  const commands: Command[] = [
    ...NAV.flatMap((g) => g.items.map(([p, I, l]) => ({ id: 'nav' + p, label: l, hint: '#' + p, icon: I, run: go(p), group: 'Sayfalar' }))),
    { id: 'new', label: 'Yeni firma oluştur', icon: Plus, run: go('/firmalar?yeni'), group: 'İşlemler' },
    { id: 'theme', label: 'Temayı değiştir', hint: 'sistem → açık → koyu', icon: SunMoon, run: () => setTheme(nextTheme(getTheme())), group: 'İşlemler' },
    { id: 'app', label: 'Satış uygulamasını aç', icon: ExternalLink, run: () => window.open('/', '_blank'), group: 'İşlemler' },
    { id: 'logout', label: 'Çıkış yap', icon: LogOut, run: logout, group: 'İşlemler' },
    ...tenants.map((t) => ({ id: 't' + t.id, label: t.name, hint: `${t.slug} · ${t.status}`, icon: Building2, run: go('/firma/' + t.id), group: 'Firmalar' }))
  ];

  return (
    <div className="app">
      <aside className={'sidebar' + (menu ? ' open' : '')}>
        <div className="p-brand"><TerminalSquare size={20} /><span>saha-crm</span><span className="tag">platform</span></div>
        <nav>
          {NAV.map((g) => (
            <div key={g.group} className="nav-group">
              <div className="nav-h">// {g.group}</div>
              {g.items.map(([p, I, l]) => <a key={p} href={'#' + p} className={active(p) ? 'on' : ''}><I size={16} strokeWidth={1.8} />{l}</a>)}
            </div>
          ))}
          <div className="nav-group">
            <div className="nav-h">// uygulama</div>
            <a href="/" target="_blank" rel="noreferrer"><ExternalLink size={16} strokeWidth={1.8} />Satış uygulaması</a>
          </div>
        </nav>
        <div className="side-foot">
          <div className="me">
            <div><b>{admin.name}</b><small>{admin.email}</small></div>
            <button className="icon-btn" title="Çıkış yap" onClick={logout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}

      <main>
        <header className="p-top">
          <button className="icon-btn p-menu" onClick={() => setMenu(true)} aria-label="Menü"><Menu size={19} /></button>
          <div className="crumbs"><span className="dim">~/platform</span>{crumbs.map((c) => <span key={c}><span className="dim">/</span>{c}</span>)}</div>
          <span className="grow" />
          <ApiStatus />
          <span className="env-pill" title="Ortam">prod</span>
          <button className="kbd-btn" onClick={() => setPalette(true)} title="Komut paleti"><Cmd size={13} /> K</button>
          <ThemeToggle />
        </header>
        <div className="p-content">{page}</div>
      </main>
      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
    </div>
  );
}
