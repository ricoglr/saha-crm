import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { PRODUCTS } from '../constants';
import { Chips, Empty, Select, useCustomerMap } from '../components/ui';
import { QuoteRow } from '../components/rows';
import { useForms } from '../components/forms';
import { Bar } from './Dashboard';
import { norm } from '../format';

export default function Quotes() {
  const open = useForms();
  const cmap = useCustomerMap();
  const [status, setStatus] = useState('all');
  const [product, setProduct] = useState('');
  const [q, setQ] = useState('');
  const quotes = useLiveQuery(() => db.quotes.toArray(), []) || [];
  const nq = norm(q);
  const list = quotes
    .filter((x) => (status === 'all' || x.status === status) && (!product || x.product === product) &&
      (!nq || [cmap.get(x.customerId)?.name, x.spec, x.notes, x.lostNote].some((s) => norm(s).includes(nq))))
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  const count = (s: string) => quotes.filter((x) => x.status === s).length;
  const lost = quotes.filter((x) => x.status === 'tutmadi');
  const reasons = Object.entries(lost.reduce<Record<string, number>>((a, x) => { const r = x.lostReason || 'Belirtilmedi'; a[r] = (a[r] || 0) + 1; return a; }, {}))
    .sort((a, b) => b[1] - a[1]);
  const decided = count('tuttu') + count('tutmadi');
  return (
    <div className="page">
      <div className="page-head">
        <h1>Fiyat teklifleri</h1>
        <button className="btn primary" onClick={() => open({ type: 'quote' })}><Plus size={16} /> Teklif</button>
      </div>
      <div className="stats three">
        <div className="stat"><span>Beklemede</span><b>{count('beklemede')}</b></div>
        <div className="stat"><span>Tuttu</span><b className="green">{count('tuttu')}</b></div>
        <div className="stat"><span>Tutmadı</span><b className="red">{count('tutmadi')}</b><small>{decided ? `Tutma oranı %${Math.round((count('tuttu') / decided) * 100)}` : ''}</small></div>
      </div>
      {reasons.length > 0 && (status === 'all' || status === 'tutmadi') && (
        <section className="card">
          <h3>Tutmama nedenleri</h3>
          <div className="bars">{reasons.map(([r, n]) => <Bar key={r} label={r} n={n} max={reasons[0][1]} tone="red" />)}</div>
        </section>
      )}
      <Chips value={status} onChange={setStatus} options={[['all', 'Tümü'], ['beklemede', 'Beklemede'], ['tuttu', 'Tuttu'], ['tutmadi', 'Tutmadı']]} />
      <div className="filters">
        <input className="search" placeholder="Ara: müşteri, ölçü, not…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={product} onChange={setProduct} options={PRODUCTS} empty="Tüm ürünler" />
      </div>
      {list.length ? <div className="list">{list.map((x) => <QuoteRow key={x.id} q={x} c={cmap.get(x.customerId)} />)}</div> : <Empty>Teklif kaydı yok.</Empty>}
    </div>
  );
}
