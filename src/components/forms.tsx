import { createContext, useContext, useState, type ReactNode } from 'react';
import { now, today, ensureCustomer, deleteCustomer, save, remove, type Customer, type Visit, type Quote, type Project, type Barter, type Region } from '../db';
import {
  CUSTOMER_GROUPS, CUSTOMER_STATUS, VISIT_KINDS, PRODUCTS, UNITS, CURRENCIES, QUOTE_STATUS, LOST_REASONS,
  PROJECT_STAGES, BARTER_TYPES, BARTER_STATUS, REGION_STATUS, HOME_CITY
} from '../constants';
import { Modal, Field, Select, CityDistrict, CustomerPicker, type CustomerPick } from './ui';
import { go } from '../router';

export type FormRequest =
  | { type: 'customer'; initial?: Partial<Customer> }
  | { type: 'visit'; initial?: Partial<Visit> }
  | { type: 'quote'; initial?: Partial<Quote> }
  | { type: 'project'; initial?: Partial<Project> }
  | { type: 'barter'; initial?: Partial<Barter> }
  | { type: 'region'; initial: Region };

const Ctx = createContext<(r: FormRequest) => void>(() => {});
export const useForms = () => useContext(Ctx);

export function FormProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<FormRequest | null>(null);
  const close = () => setReq(null);
  return (
    <Ctx.Provider value={setReq}>
      {children}
      {req?.type === 'customer' && <CustomerForm initial={req.initial} onClose={close} />}
      {req?.type === 'visit' && <VisitForm initial={req.initial} onClose={close} />}
      {req?.type === 'quote' && <QuoteForm initial={req.initial} onClose={close} />}
      {req?.type === 'project' && <ProjectForm initial={req.initial} onClose={close} />}
      {req?.type === 'barter' && <BarterForm initial={req.initial} onClose={close} />}
      {req?.type === 'region' && <RegionForm initial={req.initial} onClose={close} />}
    </Ctx.Provider>
  );
}

function useFormState<T extends object>(init: T) {
  const [v, setV] = useState<T>(init);
  const set = <K extends keyof T>(k: K) => (val: T[K]) => setV((p) => ({ ...p, [k]: val }));
  const inp = <K extends keyof T>(k: K) => ({
    value: (v[k] as any) ?? '',
    onChange: (e: { target: { value: string } }) => set(k)(e.target.value as any)
  });
  const numInp = <K extends keyof T>(k: K) => ({
    type: 'number', inputMode: 'decimal' as const, step: 'any',
    value: (v[k] as any) ?? '',
    onChange: (e: { target: { value: string } }) => set(k)((e.target.value === '' ? undefined : Number(e.target.value)) as any)
  });
  return { v, setV, set, inp, numInp };
}

function Footer({ onClose, onDelete, saving }: { onClose: () => void; onDelete?: () => void; saving?: boolean }) {
  return (
    <>
      {onDelete && <button type="button" className="btn danger ghost" onClick={onDelete}>Sil</button>}
      <span className="grow" />
      <button type="button" className="btn ghost" onClick={onClose}>Vazgeç</button>
      <button type="submit" form="entity-form" className="btn primary" disabled={saving}>Kaydet</button>
    </>
  );
}

function useSubmit(fn: () => Promise<void>, onClose: () => void) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try { await fn(); onClose(); } catch (x: any) { setErr(x?.message || String(x)); } finally { setSaving(false); }
  };
  return { submit, saving, err };
}

const confirmDel = (what: string) => confirm(`${what} silinsin mi? Bu işlem geri alınamaz.`);

/* ---------- Müşteri ---------- */
function CustomerForm({ initial, onClose }: { initial?: Partial<Customer>; onClose: () => void }) {
  const f = useFormState<Partial<Customer>>({ city: HOME_CITY, status: 'potansiyel', ...initial });
  const { v } = f;
  const s = useSubmit(async () => {
    if (!v.name?.trim()) throw new Error('Firma / kişi adı gerekli');
    const isNew = !v.id;
    const id = await save('customers', { ...v, name: v.name.trim(), updatedAt: now(), createdAt: v.createdAt || now() });
    if (isNew) go('/musteri/' + id);
  }, onClose);
  return (
    <Modal title={v.id ? 'Müşteriyi düzenle' : 'Yeni müşteri'} onClose={onClose}
      footer={<Footer onClose={onClose} saving={s.saving} onDelete={v.id ? async () => {
        if (confirmDel('Müşteri ve tüm görüşme/teklif kayıtları')) { await deleteCustomer(v.id!); onClose(); go('/musteriler'); }
      } : undefined} />}>
      <form id="entity-form" className="grid" onSubmit={s.submit}>
        <Field label="Firma / kişi adı *" full><input {...f.inp('name')} autoFocus /></Field>
        <Field label="Yetkili kişi"><input {...f.inp('contact')} /></Field>
        <Field label="Müşteri grubu"><Select value={v.group} onChange={f.set('group')} options={CUSTOMER_GROUPS} empty="Seçiniz" /></Field>
        <Field label="Telefon"><input {...f.inp('phone')} type="tel" inputMode="tel" /></Field>
        <Field label="2. telefon"><input {...f.inp('phone2')} type="tel" inputMode="tel" /></Field>
        <Field label="E-posta"><input {...f.inp('email')} type="email" /></Field>
        <Field label="Durum"><Select value={v.status} onChange={f.set('status')} options={CUSTOMER_STATUS} /></Field>
        <CityDistrict city={v.city} district={v.district} onChange={(c, d) => f.setV((p) => ({ ...p, city: c, district: d }))} />
        <Field label="Adres" full><textarea rows={2} {...f.inp('address')} /></Field>
        <Field label="Notlar" full><textarea rows={3} {...f.inp('notes')} /></Field>
        {s.err && <p className="error full">{s.err}</p>}
      </form>
    </Modal>
  );
}

/* ---------- Görüşme / ziyaret ---------- */
function VisitForm({ initial, onClose }: { initial?: Partial<Visit>; onClose: () => void }) {
  const f = useFormState<Partial<Visit>>({ date: today(), kind: 'saha', city: HOME_CITY, ...initial });
  const [pick, setPick] = useState<CustomerPick>({ id: initial?.customerId });
  const { v } = f;
  const s = useSubmit(async () => {
    const customerId = await ensureCustomer(pick, v.city, v.district);
    const rec = { ...v, customerId } as Visit;
    await save('visits', { ...rec, createdAt: rec.createdAt || now() });
  }, onClose);
  return (
    <Modal title={v.id ? 'Görüşmeyi düzenle' : 'Yeni görüşme / ziyaret'} onClose={onClose}
      footer={<Footer onClose={onClose} saving={s.saving} onDelete={v.id ? async () => {
        if (confirmDel('Görüşme')) { await remove('visits', v.id!); onClose(); }
      } : undefined} />}>
      <form id="entity-form" className="grid" onSubmit={s.submit}>
        <Field label="Müşteri *" full>
          <CustomerPicker value={pick} onChange={(p, c, d) => {
            setPick(p);
            if (p.id && !v.id) f.setV((x) => ({ ...x, city: c || x.city, district: d || '' }));
          }} />
        </Field>
        <Field label="Görüşme türü"><Select value={v.kind} onChange={f.set('kind')} options={VISIT_KINDS} /></Field>
        <Field label="Tarih"><input type="date" {...f.inp('date')} /></Field>
        <CityDistrict city={v.city} district={v.district} onChange={(c, d) => f.setV((p) => ({ ...p, city: c, district: d }))} />
        <Field label="Konu" full><input {...f.inp('subject')} placeholder="Örn. Demir ihtiyacı, yeni şantiye, tahsilat…" /></Field>
        <Field label="Neler konuşuldu?" full><textarea rows={5} {...f.inp('notes')} /></Field>
        <Field label="Tekrar aranacak / gidilecek tarih"><input type="date" {...f.inp('nextDate')} /></Field>
        {s.err && <p className="error full">{s.err}</p>}
      </form>
    </Modal>
  );
}

/* ---------- Fiyat teklifi ---------- */
function QuoteForm({ initial, onClose }: { initial?: Partial<Quote>; onClose: () => void }) {
  const f = useFormState<Partial<Quote>>({ date: today(), status: 'beklemede', unit: 'ton', currency: 'TL', product: PRODUCTS[0], ...initial });
  const [pick, setPick] = useState<CustomerPick>({ id: initial?.customerId });
  const { v } = f;
  const s = useSubmit(async () => {
    const customerId = await ensureCustomer(pick);
    const rec = { ...v, customerId } as Quote;
    if (rec.status !== 'tutmadi') { rec.lostReason = undefined; rec.lostNote = undefined; rec.competitorPrice = undefined; }
    await save('quotes', { ...rec, createdAt: rec.createdAt || now() });
  }, onClose);
  return (
    <Modal title={v.id ? 'Teklifi düzenle' : 'Yeni fiyat teklifi'} onClose={onClose}
      footer={<Footer onClose={onClose} saving={s.saving} onDelete={v.id ? async () => {
        if (confirmDel('Teklif')) { await remove('quotes', v.id!); onClose(); }
      } : undefined} />}>
      <form id="entity-form" className="grid" onSubmit={s.submit}>
        <Field label="Müşteri *" full><CustomerPicker value={pick} onChange={(p) => setPick(p)} /></Field>
        <Field label="Ürün"><Select value={v.product} onChange={f.set('product')} options={PRODUCTS} /></Field>
        <Field label="Ölçü / kalite"><input {...f.inp('spec')} placeholder="Örn. Ø12, 2 mm, B500C" /></Field>
        <Field label="Miktar"><input {...f.numInp('quantity')} /></Field>
        <Field label="Birim"><Select value={v.unit} onChange={f.set('unit')} options={UNITS} /></Field>
        <Field label="Birim fiyat"><input {...f.numInp('price')} /></Field>
        <Field label="Para birimi"><Select value={v.currency} onChange={f.set('currency')} options={CURRENCIES} /></Field>
        <Field label="Vade / ödeme"><input {...f.inp('paymentTerm')} placeholder="Peşin, 30 gün, çek…" /></Field>
        <Field label="Teklif tarihi"><input type="date" {...f.inp('date')} /></Field>
        <Field label="Durum" full>
          <div className="seg">
            {Object.entries(QUOTE_STATUS).map(([k, l]) => (
              <button type="button" key={k} className={'seg-btn ' + k + (v.status === k ? ' on' : '')} onClick={() => f.set('status')(k)}>{l}</button>
            ))}
          </div>
        </Field>
        {v.status === 'tutmadi' && (
          <>
            <Field label="Neden tutmadı?"><Select value={v.lostReason} onChange={f.set('lostReason')} options={LOST_REASONS} empty="Seçiniz" /></Field>
            <Field label="Rakip / alınan fiyat"><input {...f.numInp('competitorPrice')} /></Field>
            <Field label="Açıklama" full><textarea rows={2} {...f.inp('lostNote')} placeholder="Hangi firmadan aldı, ne dedi…" /></Field>
          </>
        )}
        <Field label="Notlar" full><textarea rows={2} {...f.inp('notes')} /></Field>
        {s.err && <p className="error full">{s.err}</p>}
      </form>
    </Modal>
  );
}

/* ---------- Proje ---------- */
function ProjectForm({ initial, onClose }: { initial?: Partial<Project>; onClose: () => void }) {
  const f = useFormState<Partial<Project>>({ stage: 'duyum', city: HOME_CITY, ...initial });
  const [pick, setPick] = useState<CustomerPick>({ id: initial?.customerId });
  const { v } = f;
  const s = useSubmit(async () => {
    if (!v.name?.trim()) throw new Error('Proje adı gerekli');
    const customerId = pick.id || pick.newName?.trim() ? await ensureCustomer(pick, v.city, v.district) : undefined;
    const rec = { ...v, customerId, updatedAt: now() } as Project;
    await save('projects', { ...rec, createdAt: rec.createdAt || now() });
  }, onClose);
  return (
    <Modal title={v.id ? 'Projeyi düzenle' : 'Yeni proje'} onClose={onClose}
      footer={<Footer onClose={onClose} saving={s.saving} onDelete={v.id ? async () => {
        if (confirmDel('Proje')) { await remove('projects', v.id!); onClose(); }
      } : undefined} />}>
      <form id="entity-form" className="grid" onSubmit={s.submit}>
        <Field label="Proje adı *" full><input {...f.inp('name')} placeholder="Örn. Selçuklu 120 konutluk site" autoFocus /></Field>
        <Field label="İlgili müşteri (varsa)" full><CustomerPicker value={pick} onChange={(p) => setPick(p)} /></Field>
        <Field label="Müteahhit / yüklenici"><input {...f.inp('contractor')} /></Field>
        <Field label="Aşama"><Select value={v.stage} onChange={f.set('stage')} options={PROJECT_STAGES} /></Field>
        <CityDistrict city={v.city} district={v.district} onChange={(c, d) => f.setV((p) => ({ ...p, city: c, district: d }))} />
        <Field label="Tahmini ihtiyaç (ton)"><input {...f.numInp('tonnage')} /></Field>
        <Field label="Başlangıç tarihi"><input type="date" {...f.inp('startDate')} /></Field>
        <Field label="Notlar" full><textarea rows={4} {...f.inp('notes')} /></Field>
        {s.err && <p className="error full">{s.err}</p>}
      </form>
    </Modal>
  );
}

/* ---------- Barter ---------- */
function BarterForm({ initial, onClose }: { initial?: Partial<Barter>; onClose: () => void }) {
  const f = useFormState<Partial<Barter>>({ date: today(), status: 'degerlendiriliyor', offerType: BARTER_TYPES[0], ...initial });
  const [pick, setPick] = useState<CustomerPick>({ id: initial?.customerId });
  const { v } = f;
  const s = useSubmit(async () => {
    if (!v.offered?.trim()) throw new Error('Teklif edilen şeyi yazın');
    const customerId = await ensureCustomer(pick);
    const rec = { ...v, customerId } as Barter;
    await save('barters', { ...rec, createdAt: rec.createdAt || now() });
  }, onClose);
  return (
    <Modal title={v.id ? 'Barter teklifini düzenle' : 'Yeni barter teklifi'} onClose={onClose}
      footer={<Footer onClose={onClose} saving={s.saving} onDelete={v.id ? async () => {
        if (confirmDel('Barter teklifi')) { await remove('barters', v.id!); onClose(); }
      } : undefined} />}>
      <form id="entity-form" className="grid" onSubmit={s.submit}>
        <Field label="Teklif eden müşteri *" full><CustomerPicker value={pick} onChange={(p) => setPick(p)} /></Field>
        <Field label="Teklif türü"><Select value={v.offerType} onChange={f.set('offerType')} options={BARTER_TYPES} /></Field>
        <Field label="Tarih"><input type="date" {...f.inp('date')} /></Field>
        <Field label="Ne teklif ediyor? *" full><input {...f.inp('offered')} placeholder="Örn. Meram'da 3+1 daire, 140 m²" /></Field>
        <Field label="Tahmini değer (TL)"><input {...f.numInp('offeredValue')} /></Field>
        <Field label="Durum"><Select value={v.status} onChange={f.set('status')} options={BARTER_STATUS} /></Field>
        <Field label="Karşılığında istediği ürün"><input {...f.inp('wanted')} placeholder="Örn. İnşaat demiri" /></Field>
        <Field label="Miktar"><input {...f.inp('quantity')} placeholder="Örn. 80 ton" /></Field>
        <Field label="Notlar" full><textarea rows={3} {...f.inp('notes')} /></Field>
        {s.err && <p className="error full">{s.err}</p>}
      </form>
    </Modal>
  );
}

/* ---------- Bölge durumu ---------- */
function RegionForm({ initial, onClose }: { initial: Region; onClose: () => void }) {
  const f = useFormState<Region>(initial);
  const s = useSubmit(async () => { await save('regions', f.v); }, onClose);
  return (
    <Modal title={`${initial.district || initial.city} — bölge durumu`} onClose={onClose}
      footer={<Footer onClose={onClose} saving={s.saving} onDelete={async () => { await remove('regions', initial.key); onClose(); }} />}>
      <form id="entity-form" className="grid" onSubmit={s.submit}>
        <Field label="Durum"><Select value={f.v.status} onChange={f.set('status')} options={REGION_STATUS} empty="Belirtilmedi" /></Field>
        <Field label="Planlanan ziyaret"><input type="date" {...f.inp('plannedDate')} /></Field>
        <Field label="Bölge notları" full><textarea rows={4} {...f.inp('notes')} placeholder="Piyasa durumu, rakipler, inşaat yoğunluğu…" /></Field>
      </form>
    </Modal>
  );
}
