import { useState } from 'react';
import { Phone, MessageCircle, Mail, MapPin, Pencil, ChevronLeft, Plus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { CUSTOMER_STATUS } from '../constants';
import { Badge, Chips, Empty } from '../components/ui';
import { VisitRow, QuoteRow, BarterRow, ProjectRow } from '../components/rows';
import { useForms } from '../components/forms';
import { relDays, telHref, waHref } from '../format';
import { Tip } from '../components/Tip';

type Tab = 'visits' | 'quotes' | 'projects' | 'barters';

export default function CustomerDetail({ id }: { id: string }) {
  const open = useForms();
  const [tab, setTab] = useState<Tab>('visits');
  const d = useLiveQuery(async () => ({
    c: await db.customers.get(id),
    visits: (await db.visits.where('customerId').equals(id).toArray()).sort((a, b) => b.date.localeCompare(a.date)),
    quotes: (await db.quotes.where('customerId').equals(id).toArray()).sort((a, b) => b.date.localeCompare(a.date)),
    projects: await db.projects.where('customerId').equals(id).toArray(),
    barters: (await db.barters.where('customerId').equals(id).toArray()).sort((a, b) => b.date.localeCompare(a.date))
  }), [id]);
  if (!d) return null;
  const { c } = d;
  if (!c) return <div className="page"><Empty>Müşteri bulunamadı. <a href="#/musteriler">Listeye dön</a></Empty></div>;
  const field = d.visits.filter((v) => v.kind === 'saha').length;
  const incoming = d.visits.filter((v) => v.kind === 'gelen').length;
  const won = d.quotes.filter((q) => q.status === 'tuttu').length;
  const lost = d.quotes.filter((q) => q.status === 'tutmadi').length;
  const mapQ = encodeURIComponent([c.name, c.address, c.district, c.city].filter(Boolean).join(', '));

  return (
    <div className="page">
      <a href="#/musteriler" className="back"><ChevronLeft size={16} /> Müşteriler</a>
      <div className="card cust-head">
        <div className="cust-title">
          <div>
            <h1>{c.name}</h1>
            <div className="muted">{[c.contact, c.group].filter(Boolean).join(' · ')}</div>
            <div className="muted">{[c.address, c.district, c.city].filter(Boolean).join(', ')}</div>
          </div>
          <div className="cust-badges">
            <Badge tone={c.status === 'aktif' ? 'green' : c.status === 'pasif' ? 'gray' : 'blue'}>{CUSTOMER_STATUS[c.status || 'potansiyel']}</Badge>
            <button className="btn ghost sm" onClick={() => open({ type: 'customer', initial: c })}><Pencil size={14} /> Düzenle</button>
          </div>
        </div>
        <div className="actions contact">
          {c.phone && <a className="btn" href={telHref(c.phone)}><Phone size={15} /> Ara</a>}
          {c.phone && <a className="btn" href={waHref(c.phone)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>}
          {c.phone2 && <a className="btn" href={telHref(c.phone2)}><Phone size={15} /> 2. Tel</a>}
          {c.email && <a className="btn" href={'mailto:' + c.email}><Mail size={15} /> E-posta</a>}
          <a className="btn" href={'https://www.google.com/maps/search/?api=1&query=' + mapQ} target="_blank" rel="noreferrer"><MapPin size={15} /> Harita</a>
        </div>
        <div className="mini-stats">
          <div><b>{d.visits.length}</b><small>görüşme</small></div>
          <div><b>{field}</b><small>saha ziyareti</small></div>
          <div><b>{incoming}</b><small>bize geldi</small></div>
          <div><b>{d.quotes.length}</b><small>teklif ({won} tuttu, {lost} tutmadı)</small></div>
          <div><b>{d.visits[0] ? relDays(d.visits[0].date) : '—'}</b><small>son görüşme</small></div>
        </div>
        {c.notes && <p className="notes">{c.notes}</p>}
      </div>

      <Tip id="customer-detail">Bu butonlarla eklediğiniz görüşme, teklif, proje ve barterde müşteri <b>otomatik seçili</b> gelir.</Tip>
      <div className="quick">
        <button className="btn primary" onClick={() => open({ type: 'visit', initial: { customerId: id, city: c.city, district: c.district } })}><Plus size={15} /> Görüşme</button>
        <button className="btn" onClick={() => open({ type: 'quote', initial: { customerId: id } })}><Plus size={15} /> Fiyat teklifi</button>
        <button className="btn" onClick={() => open({ type: 'project', initial: { customerId: id, city: c.city, district: c.district } })}><Plus size={15} /> Proje</button>
        <button className="btn" onClick={() => open({ type: 'barter', initial: { customerId: id } })}><Plus size={15} /> Barter</button>
      </div>

      <Chips value={tab} onChange={setTab} options={[
        ['visits', `Görüşmeler (${d.visits.length})`], ['quotes', `Teklifler (${d.quotes.length})`],
        ['projects', `Projeler (${d.projects.length})`], ['barters', `Barter (${d.barters.length})`]
      ]} />
      <div className="list">
        {tab === 'visits' && (d.visits.length ? d.visits.map((v) => <VisitRow key={v.id} v={v} showCustomer={false} />) : <Empty>Görüşme kaydı yok.</Empty>)}
        {tab === 'quotes' && (d.quotes.length ? d.quotes.map((q) => <QuoteRow key={q.id} q={q} showCustomer={false} />) : <Empty>Teklif kaydı yok.</Empty>)}
        {tab === 'projects' && (d.projects.length ? d.projects.map((p) => <ProjectRow key={p.id} p={p} />) : <Empty>Proje kaydı yok.</Empty>)}
        {tab === 'barters' && (d.barters.length ? d.barters.map((b) => <BarterRow key={b.id} b={b} showCustomer={false} />) : <Empty>Barter teklifi yok.</Empty>)}
      </div>
    </div>
  );
}
