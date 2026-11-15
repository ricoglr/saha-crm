import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, today } from '../db';
import { HOME_CITY, KONYA_DISTRICTS, REGION_STATUS } from '../constants';
import { Badge, Empty, Select } from '../components/ui';
import { useForms } from '../components/forms';
import { date, relDays, trSort } from '../format';

const tone: Record<string, string> = { planlandi: 'amber', ziyaret: 'blue', potansiyel: 'green', zayif: 'gray' };

export default function Regions() {
  const open = useForms();
  const [city, setCity] = useState(HOME_CITY);
  const [sort, setSort] = useState('name');
  const d = useLiveQuery(async () => ({
    visits: await db.visits.toArray(), customers: await db.customers.toArray(), regions: await db.regions.toArray()
  }), []);
  if (!d) return null;

  // city summary (all provinces visited)
  const cityStats = new Map<string, { visits: number; last?: string; customers: number }>();
  const bump = (c?: string) => { if (!c) return null; const s = cityStats.get(c) || { visits: 0, customers: 0 }; cityStats.set(c, s); return s; };
  d.visits.filter((v) => v.kind === 'saha').forEach((v) => { const s = bump(v.city); if (s) { s.visits++; if (!s.last || v.date > s.last) s.last = v.date; } });
  d.customers.forEach((c) => { const s = bump(c.city); if (s) s.customers++; });
  bump(HOME_CITY);
  const cities = [...cityStats.entries()].sort((a, b) => b[1].visits - a[1].visits || trSort(a[0], b[0]));

  // district rows for chosen city
  const names = new Set<string>();
  if (city === HOME_CITY) KONYA_DISTRICTS.forEach((x) => names.add(x));
  d.visits.forEach((v) => v.city === city && v.district && names.add(v.district));
  d.customers.forEach((c) => c.city === city && c.district && names.add(c.district));
  d.regions.forEach((r) => r.city === city && r.district && names.add(r.district));
  const t = today();
  let rows = [...names].map((dist) => {
    const vs = d.visits.filter((v) => v.city === city && v.district === dist && v.kind === 'saha');
    const last = vs.reduce<string | undefined>((m, v) => (!m || v.date > m ? v.date : m), undefined);
    const region = d.regions.find((r) => r.key === `${city}|${dist}`);
    return { dist, visits: vs.length, last, customers: d.customers.filter((c) => c.city === city && c.district === dist).length, region };
  });
  rows = rows.sort((a, b) => {
    if (sort === 'visits') return b.visits - a.visits;
    if (sort === 'stale') return (a.last || '').localeCompare(b.last || '');
    if (sort === 'planned') return (a.region?.plannedDate || '9999').localeCompare(b.region?.plannedDate || '9999');
    return trSort(a.dist, b.dist);
  });
  const covered = rows.filter((r) => r.visits > 0).length;

  return (
    <div className="page">
      <div className="page-head"><h1>İl / ilçe ziyaretleri</h1></div>

      <section className="card">
        <h3>Gidilen iller</h3>
        <div className="city-chips">
          {cities.map(([c, s]) => (
            <button key={c} className={'city-chip' + (c === city ? ' on' : '')} onClick={() => setCity(c)}>
              <b>{c}</b><small>{s.visits} ziyaret · {s.customers} müşteri{s.last ? ` · ${relDays(s.last)}` : ''}</small>
            </button>
          ))}
        </div>
      </section>

      <div className="page-head">
        <h2>{city} ilçeleri <small className="muted">{covered}/{rows.length} ilçeye gidildi</small></h2>
        <Select value={sort} onChange={setSort} options={{ name: 'Sırala: İsim', visits: 'En çok gidilen', stale: 'En uzun süredir gidilmeyen', planned: 'Planlanan tarihe göre' }} />
      </div>
      {rows.length ? (
        <div className="region-grid">
          {rows.map((r) => (
            <button key={r.dist} className={'region' + (r.visits ? '' : ' never')}
              onClick={() => open({ type: 'region', initial: r.region || { key: `${city}|${r.dist}`, city, district: r.dist } })}>
              <div className="row-top"><b>{r.dist}</b>{r.region?.status && <Badge tone={tone[r.region.status]}>{REGION_STATUS[r.region.status]}</Badge>}</div>
              <div className="region-nums">
                <span><b>{r.visits}</b> ziyaret</span><span><b>{r.customers}</b> müşteri</span>
              </div>
              <small className="muted">{r.last ? `Son ziyaret: ${date(r.last)} (${relDays(r.last)})` : 'Hiç gidilmedi'}</small>
              {r.region?.plannedDate && <small className={r.region.plannedDate < t ? 'late' : 'planned'}>Plan: {date(r.region.plannedDate)}</small>}
              {r.region?.notes && <small className="region-note">{r.region.notes}</small>}
            </button>
          ))}
        </div>
      ) : <Empty>Bu il için kayıt yok. Saha ziyareti eklediğinizde ilçeler burada görünür.</Empty>}
    </div>
  );
}
