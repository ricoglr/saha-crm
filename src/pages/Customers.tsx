import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { CUSTOMER_GROUPS, CUSTOMER_STATUS } from '../constants';
import { Empty, Select } from '../components/ui';
import { CustomerRow } from '../components/rows';
import { useForms } from '../components/forms';
import { norm, trSort } from '../format';
import { Tip } from '../components/Tip';

export default function Customers() {
  const open = useForms();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name');
  const data = useLiveQuery(async () => ({ customers: await db.customers.toArray(), visits: await db.visits.toArray() }), []);
  if (!data) return null;
  const stats = new Map<string, { n: number; last?: string }>();
  data.visits.forEach((v) => {
    const s = stats.get(v.customerId) || { n: 0 };
    s.n++; if (!s.last || v.date > s.last) s.last = v.date;
    stats.set(v.customerId, s);
  });
  const cities = [...new Set(data.customers.map((c) => c.city).filter(Boolean) as string[])].sort(trSort);
  const nq = norm(q);
  let list = data.customers.filter((c) =>
    (!nq || [c.name, c.contact, c.phone, c.district, c.notes].some((x) => norm(x).includes(nq))) &&
    (!group || c.group === group) && (!city || c.city === city) && (!status || c.status === status));
  list = list.sort((a, b) => {
    if (sort === 'visits') return (stats.get(b.id!)?.n || 0) - (stats.get(a.id!)?.n || 0);
    if (sort === 'last') return (stats.get(b.id!)?.last || '').localeCompare(stats.get(a.id!)?.last || '');
    if (sort === 'stale') return (stats.get(a.id!)?.last || '').localeCompare(stats.get(b.id!)?.last || '');
    return trSort(a.name, b.name);
  });
  return (
    <div className="page">
      <div className="page-head">
        <h1>Müşteriler <small className="muted">{data.customers.length}</small></h1>
        <button className="btn primary" onClick={() => open({ type: 'customer' })}><Plus size={16} /> Yeni müşteri</button>
      </div>
      <Tip id="customers">Sıralamayı <b>“En uzun süredir görüşülmeyen”</b> yaparak uzun zamandır aramadığınız müşterileri bulun. Kartı açınca tek dokunuşla arayabilir veya WhatsApp’tan yazabilirsiniz.</Tip>
      <div className="filters">
        <input className="search" placeholder="Ara: isim, yetkili, telefon, ilçe…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={group} onChange={setGroup} options={CUSTOMER_GROUPS} empty="Tüm gruplar" />
        <Select value={city} onChange={setCity} options={cities} empty="Tüm iller" />
        <Select value={status} onChange={setStatus} options={CUSTOMER_STATUS} empty="Tüm durumlar" />
        <Select value={sort} onChange={setSort} options={{ name: 'Sırala: İsim', visits: 'En çok görüşülen', last: 'Son görüşülen', stale: 'En uzun süredir görüşülmeyen' }} />
      </div>
      {list.length ? (
        <div className="list">{list.map((c) => <CustomerRow key={c.id} c={c} visits={stats.get(c.id!)?.n || 0} last={stats.get(c.id!)?.last} />)}</div>
      ) : <Empty>{data.customers.length ? 'Filtreye uyan müşteri yok.' : 'Henüz müşteri eklemediniz.'}</Empty>}
    </div>
  );
}
