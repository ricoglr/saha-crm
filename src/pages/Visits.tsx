import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Chips, Empty, useCustomerMap } from '../components/ui';
import { VisitRow } from '../components/rows';
import { useForms } from '../components/forms';
import { norm } from '../format';
import { Tip } from '../components/Tip';

export default function Visits({ incoming }: { incoming?: boolean }) {
  const open = useForms();
  const cmap = useCustomerMap();
  const [kind, setKind] = useState<string>(incoming ? 'gelen' : 'all');
  const [q, setQ] = useState('');
  const [month, setMonth] = useState('');
  const visits = useLiveQuery(() => db.visits.toArray(), []) || [];
  const k = incoming ? 'gelen' : kind;
  const nq = norm(q);
  const list = visits
    .filter((v) => (k === 'all' || v.kind === k) && (!month || v.date.startsWith(month)) &&
      (!nq || [cmap.get(v.customerId)?.name, v.subject, v.notes, v.district, v.city].some((x) => norm(x).includes(nq))))
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  const title = incoming ? 'Beni ziyarete gelenler' : 'Görüşmeler';
  return (
    <div className="page">
      <div className="page-head">
        <h1>{title} <small className="muted">{list.length}</small></h1>
        <button className="btn primary" onClick={() => open({ type: 'visit', initial: incoming ? { kind: 'gelen' } : undefined })}>
          <Plus size={16} /> {incoming ? 'Gelen ziyaret' : 'Görüşme'}
        </button>
      </div>
      {incoming && <p className="muted lead">Ofise / depoya sizi görmeye gelen müşteriler. Görüşme eklerken türü “Beni ziyarete geldi” seçilen kayıtlar burada listelenir.</p>}
      {!incoming && <Tip id="visits">Müşteri adını yazmanız yeterli; listede yoksa <b>yeni müşteri kartı otomatik açılır</b>. Konuşulanları kısa kısa yazın, sonra arama kutusundan kolayca bulursunuz.</Tip>}
      {!incoming && (
        <Chips value={kind} onChange={setKind} options={[['all', 'Tümü'], ['saha', 'Saha'], ['telefon', 'Telefon'], ['gelen', 'Gelen']]} />
      )}
      <div className="filters">
        <input className="search" placeholder="Ara: müşteri, konu, not, ilçe…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Ay" />
      </div>
      {list.length ? <div className="list">{list.map((v) => <VisitRow key={v.id} v={v} c={cmap.get(v.customerId)} />)}</div>
        : <Empty>Kayıt yok.</Empty>}
    </div>
  );
}
