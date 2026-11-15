import { CalendarClock, XCircle } from 'lucide-react';
import type { Customer, Visit, Quote, Project, Barter } from '../db';
import { VISIT_KINDS, QUOTE_STATUS, PROJECT_STAGES, BARTER_STATUS } from '../constants';
import { date, money, num, relDays } from '../format';
import { Badge } from './ui';
import { useForms } from './forms';
import { go } from '../router';

const kindTone: Record<string, string> = { saha: 'blue', telefon: 'gray', gelen: 'purple' };
const quoteTone: Record<string, string> = { beklemede: 'amber', tuttu: 'green', tutmadi: 'red' };
const stageTone: Record<string, string> = { kazanildi: 'green', kaybedildi: 'red', beklemede: 'gray', teklif: 'amber', pazarlik: 'amber' };
const barterTone: Record<string, string> = { degerlendiriliyor: 'amber', kabul: 'green', red: 'red' };

function CustLink({ c }: { c?: Customer }) {
  if (!c) return <span className="muted">—</span>;
  return <a href={'#/musteri/' + c.id} onClick={(e) => e.stopPropagation()} className="cust-link">{c.name}</a>;
}

export function VisitRow({ v, c, showCustomer = true }: { v: Visit; c?: Customer; showCustomer?: boolean }) {
  const open = useForms();
  return (
    <div className="row" onClick={() => open({ type: 'visit', initial: v })}>
      <div className="row-main">
        <div className="row-top">
          {showCustomer && <CustLink c={c} />}
          <Badge tone={kindTone[v.kind]}>{VISIT_KINDS[v.kind]}</Badge>
        </div>
        {v.subject && <div className="row-title">{v.subject}</div>}
        {v.notes && <div className="row-notes">{v.notes}</div>}
        {v.nextDate && <div className="row-next"><CalendarClock size={13} /> Takip: {date(v.nextDate)} ({relDays(v.nextDate)})</div>}
      </div>
      <div className="row-side">
        <div>{date(v.date)}</div>
        <small>{[v.district, v.city].filter(Boolean).join(', ')}</small>
      </div>
    </div>
  );
}

export function QuoteRow({ q, c, showCustomer = true }: { q: Quote; c?: Customer; showCustomer?: boolean }) {
  const open = useForms();
  return (
    <div className="row" onClick={() => open({ type: 'quote', initial: q })}>
      <div className="row-main">
        <div className="row-top">
          {showCustomer && <CustLink c={c} />}
          <Badge tone={quoteTone[q.status]}>{QUOTE_STATUS[q.status]}</Badge>
        </div>
        <div className="row-title">{q.product}{q.spec ? ` · ${q.spec}` : ''}</div>
        <div className="row-notes">
          {q.quantity ? `${num(q.quantity)} ${q.unit} · ` : ''}<b>{money(q.price, q.currency)}{q.price ? ` / ${q.unit}` : ''}</b>
          {q.paymentTerm ? ` · ${q.paymentTerm}` : ''}
        </div>
        {q.status === 'tutmadi' && (q.lostReason || q.lostNote) && (
          <div className="row-lost"><XCircle size={13} /> {q.lostReason}{q.competitorPrice ? ` (rakip: ${money(q.competitorPrice, q.currency)})` : ''}{q.lostNote ? ` — ${q.lostNote}` : ''}</div>
        )}
      </div>
      <div className="row-side"><div>{date(q.date)}</div></div>
    </div>
  );
}

export function ProjectRow({ p, c }: { p: Project; c?: Customer }) {
  const open = useForms();
  return (
    <div className="row" onClick={() => open({ type: 'project', initial: p })}>
      <div className="row-main">
        <div className="row-top"><b>{p.name}</b><Badge tone={stageTone[p.stage]}>{PROJECT_STAGES[p.stage]}</Badge></div>
        <div className="row-notes">
          {c && <><CustLink c={c} /> · </>}
          {p.contractor && <>{p.contractor} · </>}
          {p.tonnage ? `~${num(p.tonnage)} ton` : ''}
        </div>
        {p.notes && <div className="row-notes">{p.notes}</div>}
      </div>
      <div className="row-side">
        {p.startDate && <div>{date(p.startDate)}</div>}
        <small>{[p.district, p.city].filter(Boolean).join(', ')}</small>
      </div>
    </div>
  );
}

export function BarterRow({ b, c, showCustomer = true }: { b: Barter; c?: Customer; showCustomer?: boolean }) {
  const open = useForms();
  return (
    <div className="row" onClick={() => open({ type: 'barter', initial: b })}>
      <div className="row-main">
        <div className="row-top">
          {showCustomer && <CustLink c={c} />}
          <Badge tone={barterTone[b.status]}>{BARTER_STATUS[b.status]}</Badge>
        </div>
        <div className="row-title">{b.offerType}: {b.offered}</div>
        <div className="row-notes">
          {b.offeredValue ? <>Değer: <b>{money(b.offeredValue)}</b> · </> : null}
          {b.wanted ? `İstenen: ${b.wanted}${b.quantity ? ` (${b.quantity})` : ''}` : ''}
        </div>
        {b.notes && <div className="row-notes">{b.notes}</div>}
      </div>
      <div className="row-side"><div>{date(b.date)}</div></div>
    </div>
  );
}

export function CustomerRow({ c, visits, last }: { c: Customer; visits: number; last?: string }) {
  return (
    <div className="row" onClick={() => go('/musteri/' + c.id)}>
      <div className="row-main">
        <div className="row-top"><b>{c.name}</b>{c.status === 'aktif' && <Badge tone="green">Aktif</Badge>}{c.status === 'pasif' && <Badge>Pasif</Badge>}</div>
        <div className="row-notes">{[c.contact, c.group].filter(Boolean).join(' · ')}</div>
        <div className="row-notes muted">{[c.district, c.city].filter(Boolean).join(', ')}</div>
      </div>
      <div className="row-side">
        <div className="big-num">{visits}</div>
        <small>görüşme</small>
        {last && <small>son: {relDays(last)}</small>}
      </div>
    </div>
  );
}
