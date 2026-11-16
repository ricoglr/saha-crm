import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, MessagesSquare, MapPinned, BadgePercent, Building2, DoorOpen, ArrowLeftRight, Settings as Cog,
  Plus, Menu, ChevronRight, ShieldCheck, LogOut, type LucideIcon
} from 'lucide-react';
import { useRoute, go } from './router';
import { FormProvider, useForms, type FormRequest } from './components/forms';
import { AuthProvider, useAuth } from './auth';
import { startSync } from './sync';
import { SyncBadge } from './components/SyncBadge';
import { Onboarding } from './components/Onboarding';
import { useGuide } from './guide';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Visits from './pages/Visits';
import Regions from './pages/Regions';
import Quotes from './pages/Quotes';
import Projects from './pages/Projects';
import Barters from './pages/Barters';
import Settings from './pages/Settings';

type Icon = LucideIcon;
const NAV: [string, Icon, string][] = [
  ['/', LayoutDashboard, 'Panel'],
  ['/musteriler', Users, 'Müşteriler'],
  ['/gorusmeler', MessagesSquare, 'Görüşmeler'],
  ['/bolgeler', MapPinned, 'İl / İlçe'],
  ['/teklifler', BadgePercent, 'Fiyat Teklifleri'],
  ['/projeler', Building2, 'Yeni Projeler'],
  ['/gelenler', DoorOpen, 'Bana Gelenler'],
  ['/barter', ArrowLeftRight, 'Barter'],
  ['/ayarlar', Cog, 'Ayarlar']
];

const QUICK: [Icon, string, FormRequest][] = [
  [MessagesSquare, 'Görüşme / saha ziyareti', { type: 'visit' }],
  [DoorOpen, 'Beni ziyarete gelen', { type: 'visit', initial: { kind: 'gelen' } }],
  [BadgePercent, 'Fiyat teklifi', { type: 'quote' }],
  [Users, 'Yeni müşteri', { type: 'customer' }],
  [Building2, 'Yeni proje', { type: 'project' }],
  [ArrowLeftRight, 'Barter teklifi', { type: 'barter' }]
];

function Page({ route, isAdmin }: { route: string; isAdmin: boolean }) {
  const m = route.match(/^\/musteri\/([^/]+)/);
  if (m) return <CustomerDetail id={decodeURIComponent(m[1])} />;
  switch (route) {
    case '/musteriler': return <Customers />;
    case '/gorusmeler': return <Visits />;
    case '/gelenler': return <Visits incoming key="in" />;
    case '/bolgeler': return <Regions />;
    case '/teklifler': return <Quotes />;
    case '/projeler': return <Projects />;
    case '/barter': return <Barters />;
    case '/ayarlar': return <Settings />;
    case '/admin': return isAdmin ? <Admin /> : <Dashboard />;
    default: return <Dashboard />;
  }
}

function Shell() {
  const route = useRoute();
  const open = useForms();
  const [menu, setMenu] = useState(false);
  const [quick, setQuick] = useState(false);
  const active = (p: string) => (p === '/' ? route === '/' : route.startsWith(p) || (p === '/musteriler' && route.startsWith('/musteri/')));
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  useEffect(() => startSync(), []);
  const guide = useGuide(user!.id);
  const nav = isAdmin ? [...NAV.slice(0, -1), ['/admin', ShieldCheck, 'Yönetim'] as [string, Icon, string], NAV[NAV.length - 1]] : NAV;

  const quickAdd = (fn: () => void) => { setQuick(false); fn(); };

  return (
    <div className="app">
      <aside className={'sidebar' + (menu ? ' open' : '')}>
        <div className="brand"><img src="/icon.svg" alt="" /><div><b>Saha CRM</b><small>Satış &amp; Pazarlama</small></div></div>
        <nav>
          {nav.map(([p, I, l]) => (
            <a key={p} href={'#' + p} className={active(p) ? 'on' : ''} onClick={() => setMenu(false)}><I size={17} strokeWidth={1.8} />{l}</a>
          ))}
        </nav>
        <div className="side-foot">
          <SyncBadge />
          <div className="me">
            <div><b>{user?.name}</b><small>{isAdmin ? 'Yönetici' : 'Satış temsilcisi'}</small></div>
            <button className="icon-btn" title="Hesap ve çıkış" onClick={() => { setMenu(false); go('/ayarlar'); }}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}

      <main>
        <div className="mobile-sync"><SyncBadge compact /></div>
        <Page route={route} isAdmin={isAdmin} />
      </main>

      <nav className="bottom">
        <a href="#/" className={active('/') ? 'on' : ''}><LayoutDashboard size={21} strokeWidth={1.8} />Panel</a>
        <a href="#/musteriler" className={active('/musteriler') ? 'on' : ''}><Users size={21} strokeWidth={1.8} />Müşteriler</a>
        <button className="fab" onClick={() => setQuick(true)} aria-label="Hızlı ekle"><Plus size={26} strokeWidth={2.2} /></button>
        <a href="#/teklifler" className={active('/teklifler') ? 'on' : ''}><BadgePercent size={21} strokeWidth={1.8} />Teklifler</a>
        <button onClick={() => setMenu(true)}><Menu size={21} strokeWidth={1.8} />Menü</button>
      </nav>

      {!guide.tourDone && <Onboarding name={user!.name} isAdmin={isAdmin} />}

      {quick && (
        <div className="modal-bg" onClick={() => setQuick(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Hızlı ekle</h3>
            {QUICK.map(([I, l, req]) => (
              <button key={l} onClick={() => quickAdd(() => open(req))}><I size={18} strokeWidth={1.8} />{l}<ChevronRight size={16} className="chev" /></button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Gate() {
  const { user } = useAuth();
  if (!user) return <Login />;
  return <FormProvider key={user.id}><Shell /></FormProvider>;
}

export default function App() {
  return <AuthProvider><Gate /></AuthProvider>;
}
