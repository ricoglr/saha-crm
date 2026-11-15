import Dexie, { type Table } from 'dexie';

export interface Customer {
  id: string; name: string; contact?: string; phone?: string; phone2?: string; email?: string; city?: string;
  district?: string; address?: string; group?: string; status?: string; notes?: string; createdAt: string; updatedAt: string;
}
export interface Visit {
  id: string; customerId: string; date: string; kind: string; city?: string; district?: string; subject?: string;
  notes?: string; nextDate?: string; createdAt: string;
}
export interface Quote {
  id: string; customerId: string; date: string; product: string; spec?: string; quantity?: number; unit?: string;
  price?: number; currency?: string; paymentTerm?: string; status: string; lostReason?: string; lostNote?: string;
  competitorPrice?: number; notes?: string; createdAt: string;
}
export interface Project {
  id: string; name: string; customerId?: string; city?: string; district?: string; stage: string; tonnage?: number;
  contractor?: string; startDate?: string; notes?: string; createdAt: string; updatedAt: string;
}
export interface Barter {
  id: string; customerId: string; date: string; offerType?: string; offered: string; offeredValue?: number;
  wanted?: string; quantity?: string; status: string; notes?: string; createdAt: string;
}
export interface Region { key: string; city: string; district: string; status?: string; plannedDate?: string; notes?: string; }

export type TableName = 'customers' | 'visits' | 'quotes' | 'projects' | 'barters' | 'regions';
export const TABLE_NAMES: TableName[] = ['customers', 'visits', 'quotes', 'projects', 'barters', 'regions'];
export interface OutboxItem { table: TableName; id: string; deleted?: boolean; n: number }

export class CrmDB extends Dexie {
  customers!: Table<Customer, string>;
  visits!: Table<Visit, string>;
  quotes!: Table<Quote, string>;
  projects!: Table<Project, string>;
  barters!: Table<Barter, string>;
  regions!: Table<Region, string>;
  outbox!: Table<OutboxItem, [string, string]>;
  meta!: Table<{ k: string; v: any }, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      customers: 'id, name, city, district, group, status',
      visits: 'id, customerId, date, kind, city, district, nextDate',
      quotes: 'id, customerId, date, status, product',
      projects: 'id, customerId, stage, city',
      barters: 'id, customerId, date, status',
      regions: 'key, city',
      outbox: '[table+id]',
      meta: 'k'
    });
  }
}

/** The signed-in user's local database (one per account, so a shared device never mixes data). */
export let db: CrmDB = null as unknown as CrmDB;
export function openUserDb(userId: string) {
  const name = 'saha-crm-u-' + userId;
  if (db?.name !== name) { db?.close(); db = new CrmDB(name); }
  return db;
}

export const now = () => new Date().toISOString();
export const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const pk = (table: TableName, rec: any): string => (table === 'regions' ? rec.key : rec.id);
let seq = 0;
const changed = () => window.dispatchEvent(new Event('crm-local-change'));

/** Every write goes through save/remove: stored locally + queued for the server. */
export async function save<T extends TableName>(table: T, rec: any): Promise<string> {
  if (table !== 'regions' && !rec.id) rec.id = uuid();
  const id = pk(table, rec);
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    await db.table(table).put(rec);
    await db.outbox.put({ table, id, n: Date.now() * 1000 + (seq++ % 1000) });
  });
  changed();
  return id;
}

export async function remove(table: TableName, id: string) {
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    await db.table(table).delete(id);
    await db.outbox.put({ table, id, deleted: true, n: Date.now() * 1000 + (seq++ % 1000) });
  });
  changed();
}

export async function deleteCustomer(id: string) {
  for (const t of ['visits', 'quotes', 'barters'] as const) {
    for (const r of await db.table(t).where('customerId').equals(id).toArray()) await remove(t, r.id);
  }
  for (const p of await db.projects.where('customerId').equals(id).toArray()) await save('projects', { ...p, customerId: undefined });
  await remove('customers', id);
}

/** Creates a minimal customer record (used when typing a new name in a picker). */
export async function ensureCustomer(pick: { id?: string; newName?: string }, city?: string, district?: string) {
  if (pick.id) return pick.id;
  const name = (pick.newName || '').trim();
  if (!name) throw new Error('Müşteri seçilmedi');
  return save('customers', { name, city, district, status: 'potansiyel', createdAt: now(), updatedAt: now() });
}

/* ---------------- backups & legacy data ---------------- */

export async function exportAll() {
  const out: any = { app: 'saha-crm', version: 2, exportedAt: now() };
  for (const t of TABLE_NAMES) out[t] = await db.table(t).toArray();
  return out;
}

/**
 * Adds the records of a backup file (or of the pre-account local database) to the current account.
 * Old backups used numeric ids; those get fresh ids and customer links are remapped.
 */
export async function importBackup(data: any) {
  if (!data || data.app !== 'saha-crm') throw new Error('Bu dosya Saha CRM yedeği değil.');
  const idMap = new Map<string, string>();
  const newId = (old: any) => {
    if (old === undefined || old === null || old === '') return undefined;
    const k = String(old);
    if (typeof old === 'string' && old.length > 20) return old; // already a uuid
    if (!idMap.has(k)) idMap.set(k, uuid());
    return idMap.get(k)!;
  };
  let count = 0;
  for (const t of TABLE_NAMES) {
    for (const r of data[t] || []) {
      const { owner, ...rec } = r;
      void owner;
      if (t === 'regions') { if (!rec.key) continue; }
      else {
        rec.id = t === 'customers' ? newId(rec.id) : (typeof rec.id === 'string' && rec.id.length > 20 ? rec.id : uuid());
        if ('customerId' in rec) rec.customerId = newId(rec.customerId);
      }
      await save(t, rec);
      count++;
    }
  }
  return count;
}

const LEGACY_DB = 'saha-crm';
export async function readLegacyData(): Promise<{ data: any; count: number } | null> {
  try {
    if (!(await Dexie.exists(LEGACY_DB))) return null;
    const old = new Dexie(LEGACY_DB);
    await old.open();
    const data: any = { app: 'saha-crm', version: 1 };
    let count = 0;
    for (const t of TABLE_NAMES) {
      data[t] = old.tables.some((x) => x.name === t) ? await old.table(t).toArray() : [];
      count += data[t].length;
    }
    old.close();
    return count ? { data, count } : null;
  } catch { return null; }
}
export async function deleteLegacyData() { await Dexie.delete(LEGACY_DB); }
