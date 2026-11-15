import { Plus, Users, MessagesSquare, BadgePercent, Building2, type LucideIcon } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, today } from '../db';
import { useCustomerMap, Empty } from '../components/ui';
import { VisitRow } from '../components/rows';
import { useForms } from '../components/forms';
import { CUSTOMER_GROUPS } from '../constants';
import { date, relDays } from '../format';

export default function Dashboard() {
  const open = useForms();
  const cmap = useCustomerMap();
  const data = useLiveQuery(async () => {
    const [customers, visits, quotes, projects, barters] = await Promise.all([
      db.customers.toArray(), db.visits.toArray(), db.quotes.toArray(), db.projects.toArray(), db.barters.toArray()
    ]);
    return { customers, visits, quotes, projects, barters };
  }, []);
  if (!data) return null;
  const { customers, visits, quotes, projects, barters } = data;
  const t = today();
  const month = t.slice(0, 7);
  const monthVisits = visits.filter((v) => v.date?.startsWith(month));
  const decided = quotes.filter((q) => q.status !== 'beklemede');
  const won = decided.filter((q) => q.status === 'tuttu').length;
  const followups = visits.filter((v) => v.nextDate && v.nextDate <= addDays(t, 7))
    .sort((a, b) => a.nextDate!.localeCompare(b.nextDate!));
  // only keep the latest follow-up per customer that is still relevant
  const latestByCustomer = new Map<string, string>();
  visits.forEach((v) => { const p = latestByCustomer.get(v.customerId); if (!p || v.date > p) latestByCustomer.set(v.customerId, v.date); });
  const openFollowups = followups.filter((v) => (latestByCustomer.get(v.customerId) || '') <= v.date);

  const groups = CUSTOMER_GROUPS.map((g) => [g, customers.filter((c) => c.group === g).length] as const).filter(([, n]) => n);
  const noGroup = customers.filter((c) => !c.group).length;
  const maxG = Math.max(1, ...groups.map(([, n]) => n), noGroup);

  const lost = quotes.filter((q) => q.status === 'tutmadi');
  const reasons = Object.entries(lost.reduce<Record<string, number>>((a, q) => { const r = q.lostReason || 'Belirtilmedi'; a[r] = (a[r] || 0) + 1; return a; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 5);

  const recent = [...visits].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 6);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Panel</h1>
        <button className="btn primary" onClick={() => open({ type: 'visit' })}><Plus size={16} /> Görüşme ekle</button>
      </div>

      <div className="stats">
        <Stat icon={Users} label="Müşteri" value={customers.length} sub={`${customers.filter((c) => c.status === 'aktif').length} aktif`} href="#/musteriler" />
        <Stat icon={MessagesSquare} label="Bu ay görüşme" value={monthVisits.length} sub={`${monthVisits.filter((v) => v.kind === 'saha').length} saha · ${monthVisits.filter((v) => v.kind === 'gelen').length} gelen`} href="#/gorusmeler" />
        <Stat icon={BadgePercent} label="Bekleyen teklif" value={quotes.filter((q) => q.status === 'beklemede').length} sub={decided.length ? `Tutma oranı %${Math.round((won / decided.length) * 100)}` : 'Henüz sonuç yok'} href="#/teklifler" />
        <Stat icon={Building2} label="Aktif proje" value={projects.filter((p) => !['kazanildi', 'kaybedildi'].includes(p.stage)).length} sub={`${barters.filter((b) => b.status === 'degerlendiriliyor').length} barter değerlendirmede`} href="#/projeler" />
      </div>

      <div className="cols">
        <section className="card">
          <h3>Yaklaşan takipler <small className="muted">(7 gün içinde / gecikmiş)</small></h3>
          {openFollowups.length ? openFollowups.map((v) => {
            const late = v.nextDate! < t;
            return (
              <a key={v.id} className="follow" href={'#/musteri/' + v.customerId}>
                <span className={late ? 'dot red' : v.nextDate === t ? 'dot amber' : 'dot'} />
                <span className="grow"><b>{cmap.get(v.customerId)?.name}</b><small>{v.subject || v.notes?.slice(0, 60)}</small></span>
                <span className={late ? 'late' : ''}>{date(v.nextDate)}<small>{relDays(v.nextDate)}</small></span>
              </a>
            );
          }) : <Empty>Yaklaşan takip yok. Görüşme eklerken “tekrar aranacak tarih” girerseniz burada görünür.</Empty>}
        </section>

        <section className="card">
          <h3>Müşteri grupları</h3>
          {customers.length ? (
            <div className="bars">
              {groups.map(([g, n]) => <Bar key={g} label={g} n={n} max={maxG} />)}
              {noGroup > 0 && <Bar label="Grup belirtilmemiş" n={noGroup} max={maxG} muted />}
            </div>
          ) : <Empty>Henüz müşteri yok.</Empty>}
        </section>

        <section className="card">
          <h3>Teklif neden tutmadı?</h3>
          {reasons.length ? (
            <div className="bars">{reasons.map(([r, n]) => <Bar key={r} label={r} n={n} max={reasons[0][1]} tone="red" />)}</div>
          ) : <Empty>Tutmayan teklif kaydı yok.</Empty>}
        </section>

        <section className="card wide">
          <h3>Son görüşmeler</h3>
          {recent.length ? <div className="list">{recent.map((v) => <VisitRow key={v.id} v={v} c={cmap.get(v.customerId)} />)}</div>
            : <Empty>İlk görüşmenizi ekleyin.</Empty>}
        </section>
      </div>
    </div>
  );
}

function addDays(d: string, n: number) {
  const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function Stat({ icon: I, label, value, sub, href }: { icon: LucideIcon; label: string; value: number; sub: string; href: string }) {
  return (
    <a className="stat" href={href}>
      <span className="stat-ic"><I size={18} strokeWidth={1.8} /></span>
      <span>{label}</span><b>{value}</b><small>{sub}</small>
    </a>
  );
}

export function Bar({ label, n, max, tone, muted }: { label: string; n: number; max: number; tone?: string; muted?: boolean }) {
  return (
    <div className={'bar' + (muted ? ' muted' : '')}>
      <span className="bar-label">{label}</span>
      <span className="bar-track"><span className={'bar-fill ' + (tone || '')} style={{ width: `${(n / max) * 100}%` }} /></span>
      <span className="bar-n">{n}</span>
    </div>
  );
}
