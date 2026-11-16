// Synced collections. Keys are the field names the app uses; values are the SQL type.
// Every table also gets: owner_id, id, rev, updated_at, deleted  (PK = owner_id + id)
export const TABLES = {
  customers: {
    name: 'text', contact: 'text', phone: 'text', phone2: 'text', email: 'text', city: 'text', district: 'text',
    address: 'text', group: 'text', status: 'text', notes: 'text', createdAt: 'timestamptz', updatedAt: 'timestamptz'
  },
  visits: {
    customerId: 'text', date: 'date', kind: 'text', city: 'text', district: 'text', subject: 'text', notes: 'text',
    nextDate: 'date', createdAt: 'timestamptz'
  },
  quotes: {
    customerId: 'text', date: 'date', product: 'text', spec: 'text', quantity: 'numeric', unit: 'text', price: 'numeric',
    currency: 'text', paymentTerm: 'text', status: 'text', lostReason: 'text', lostNote: 'text', competitorPrice: 'numeric',
    notes: 'text', createdAt: 'timestamptz'
  },
  projects: {
    name: 'text', customerId: 'text', city: 'text', district: 'text', stage: 'text', tonnage: 'numeric', contractor: 'text',
    startDate: 'date', notes: 'text', createdAt: 'timestamptz', updatedAt: 'timestamptz'
  },
  barters: {
    customerId: 'text', date: 'date', offerType: 'text', offered: 'text', offeredValue: 'numeric', wanted: 'text',
    quantity: 'text', status: 'text', notes: 'text', createdAt: 'timestamptz'
  },
  regions: {
    city: 'text', district: 'text', status: 'text', plannedDate: 'date', notes: 'text'
  }
};

/** camelCase app field -> snake_case column ("group" is reserved in SQL; updated_at is the server's own column) */
const RENAMED = { group: 'grp', updatedAt: 'client_updated_at' };
export const col = (f) => RENAMED[f] || f.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

/** Creates / upgrades one company's database. */
export async function migrate(sql) {
  await sql`create extension if not exists pgcrypto`;
  await sql`create sequence if not exists rev_seq`;
  await sql`
    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      name text not null,
      password_hash text not null,
      role text not null default 'rep' check (role in ('admin', 'rep')),
      active boolean not null default true,
      token_version int not null default 0,
      created_at timestamptz not null default now(),
      last_login_at timestamptz,
      last_sync_at timestamptz
    )`;
  // last "what's new" announcement this user has dismissed (announcements live in the control DB)
  await sql`alter table users add column if not exists seen_announcement int not null default 0`;
  for (const [table, fields] of Object.entries(TABLES)) {
    const cols = Object.entries(fields).map(([f, t]) => `"${col(f)}" ${t}`).join(',\n      ');
    await sql.unsafe(`
      create table if not exists ${table} (
        owner_id uuid not null references users(id),
        id text not null,
        rev bigint not null default nextval('rev_seq'),
        updated_at timestamptz not null default now(),
        deleted boolean not null default false,
        ${cols},
        primary key (owner_id, id)
      )`);
    // add columns introduced in later versions
    for (const [f, t] of Object.entries(fields)) {
      await sql.unsafe(`alter table ${table} add column if not exists "${col(f)}" ${t}`);
    }
    await sql.unsafe(`create index if not exists ${table}_owner_rev on ${table} (owner_id, rev)`);
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate + coerce one incoming record into DB columns (unknown fields dropped). */
export function toRow(table, data) {
  const fields = TABLES[table];
  const row = {};
  for (const [f, t] of Object.entries(fields)) {
    let v = data[f];
    if (v === undefined || v === null || v === '') { row[col(f)] = null; continue; }
    if (t === 'numeric') { v = Number(v); row[col(f)] = Number.isFinite(v) ? v : null; }
    else if (t === 'date') row[col(f)] = typeof v === 'string' && DATE.test(v.slice(0, 10)) ? v.slice(0, 10) : null;
    else if (t === 'timestamptz') { const d = new Date(v); row[col(f)] = isNaN(d.getTime()) ? null : d; }
    else row[col(f)] = String(v).slice(0, 20000);
  }
  return row;
}

/** DB row -> app record */
export function fromRow(table, r) {
  const out = { id: r.id };
  for (const f of Object.keys(TABLES[table])) {
    const v = r[col(f)];
    if (v !== null && v !== undefined) out[f] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}
