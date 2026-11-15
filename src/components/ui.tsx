import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { KONYA_DISTRICTS, PROVINCES, HOME_CITY } from '../constants';
import { norm, trSort } from '../format';

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.classList.add('noscroll');
    return () => { window.removeEventListener('keydown', k); document.body.classList.remove('noscroll'); };
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={'field' + (full ? ' full' : '')}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Select({ value, onChange, options, empty }: { value?: string; onChange: (v: string) => void; options: Record<string, string> | string[]; empty?: string }) {
  const entries = Array.isArray(options) ? options.map((o) => [o, o]) : Object.entries(options);
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {entries.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}

export function CityDistrict({ city, district, onChange }: { city?: string; district?: string; onChange: (city: string, district: string) => void }) {
  const known = useLiveQuery(async () => {
    const c = city || HOME_CITY;
    const set = new Set<string>();
    if (c === HOME_CITY) KONYA_DISTRICTS.forEach((d) => set.add(d));
    (await db.customers.where('city').equals(c).toArray()).forEach((x) => x.district && set.add(x.district));
    (await db.visits.where('city').equals(c).toArray()).forEach((x) => x.district && set.add(x.district));
    return [...set].sort(trSort);
  }, [city]);
  const listId = useMemo(() => 'dl-' + Math.random().toString(36).slice(2), []);
  return (
    <>
      <Field label="İl">
        <select value={city || ''} onChange={(e) => onChange(e.target.value, '')}>
          <option value="">Seçiniz</option>
          {PROVINCES.map((p) => <option key={p}>{p}</option>)}
        </select>
      </Field>
      <Field label="İlçe / Bölge">
        <input list={listId} value={district || ''} onChange={(e) => onChange(city || '', e.target.value)} placeholder="Yazın veya seçin" />
        <datalist id={listId}>{(known || []).map((d) => <option key={d} value={d} />)}</datalist>
      </Field>
    </>
  );
}

export type CustomerPick = { id?: string; newName?: string };

export function CustomerPicker({ value, onChange, allowNew = true }: { value: CustomerPick; onChange: (v: CustomerPick, city?: string, district?: string) => void; allowNew?: boolean }) {
  const customers = useLiveQuery(() => db.customers.toArray(), []) || [];
  const selected = value.id ? customers.find((c) => c.id === value.id) : undefined;
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const text = open ? q : selected ? selected.name : value.newName || '';
  const matches = customers
    .filter((c) => !q || norm(c.name).includes(norm(q)) || norm(c.contact).includes(norm(q)))
    .sort((a, b) => trSort(a.name, b.name))
    .slice(0, 30);
  const exact = customers.some((c) => norm(c.name) === norm(q.trim()));
  return (
    <div className="picker" ref={ref}>
      <input
        value={text}
        placeholder="Müşteri ara veya yeni isim yaz"
        onFocus={() => { setQ(selected?.name || value.newName || ''); setOpen(true); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); if (allowNew) onChange({ newName: e.target.value }); }}
      />
      {open && (
        <div className="picker-list">
          {allowNew && q.trim() && !exact && (
            <button type="button" className="picker-new" onClick={() => { onChange({ newName: q.trim() }); setOpen(false); }}>
              + “{q.trim()}” yeni müşteri olarak eklensin
            </button>
          )}
          {matches.map((c) => (
            <button type="button" key={c.id} onClick={() => { onChange({ id: c.id }, c.city, c.district); setOpen(false); }}>
              <b>{c.name}</b>
              <small>{[c.contact, c.district, c.city].filter(Boolean).join(' · ')}</small>
            </button>
          ))}
          {!matches.length && !q.trim() && <div className="muted pad">Henüz müşteri yok</div>}
        </div>
      )}
      {value.newName && !value.id && <small className="hint">Kaydedince yeni müşteri kartı açılır.</small>}
    </div>
  );
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="chips">
      {options.map(([k, l]) => (
        <button key={k} className={value === k ? 'chip on' : 'chip'} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

export function useCustomerMap() {
  const list = useLiveQuery(() => db.customers.toArray(), []) || [];
  return useMemo(() => new Map(list.map((c) => [c.id!, c])), [list]);
}
