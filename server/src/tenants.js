import { connect, BASE_DB, CONTROL_DB } from './db.js';
import { migrate } from './schema.js';
import { hashPassword, validatePassword } from './auth.js';

/** Platform registry database (companies, login directory, platform admins, audit log). */
export let control;
const pools = new Map(); // tenantId -> postgres client of that company's database
const cache = new Map(); // tenantId -> { t, at }
let legacyId = null;

export const SLUG = /^[a-z][a-z0-9]{2,29}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normEmail = (e) => String(e || '').trim().toLowerCase();
export class HttpError extends Error { constructor(msg, statusCode = 400) { super(msg); this.statusCode = statusCode; } }

export async function initControl() {
  const boot = connect(BASE_DB, { max: 1 });
  const [exists] = await boot`select 1 from pg_database where datname = ${CONTROL_DB}`;
  if (!exists) await boot.unsafe(`create database "${CONTROL_DB}"`);
  control = connect(CONTROL_DB, { max: 4 });
  await control`create extension if not exists pgcrypto`;
  await control`
    create table if not exists tenants (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique,
      name text not null,
      db_name text not null unique,
      status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
      plan text,
      max_users int,
      contact_name text, contact_email text, contact_phone text, notes text,
      is_legacy boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    )`;
  await control`
    create table if not exists accounts (
      email text primary key,
      tenant_id uuid not null references tenants(id),
      user_id uuid not null
    )`;
  await control`
    create table if not exists platform_admins (
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      name text not null,
      password_hash text not null,
      active boolean not null default true,
      token_version int not null default 0,
      created_at timestamptz not null default now(),
      last_login_at timestamptz
    )`;
  await control`
    create table if not exists audit_log (
      id bigserial primary key,
      at timestamptz not null default now(),
      actor_id uuid, actor_email text, ip text,
      action text not null, target text, details jsonb
    )`;

  // First start after upgrading: the existing single-company database becomes the first tenant.
  const [{ n }] = await control`select count(*)::int as n from tenants`;
  if (n === 0 && BASE_DB !== CONTROL_DB) {
    const [{ t }] = await boot`select to_regclass('public.users') as t`;
    if (t) {
      const [tenant] = await control`
        insert into tenants (slug, name, db_name, is_legacy)
        values ('firma1', ${process.env.DEFAULT_TENANT_NAME || 'İlk firma'}, ${BASE_DB}, true) returning *`;
      for (const u of await boot`select id, email from users`) {
        await control`insert into accounts (email, tenant_id, user_id) values (${u.email}, ${tenant.id}, ${u.id}) on conflict do nothing`;
      }
      console.log(`registered existing database "${BASE_DB}" as tenant "${tenant.name}"`);
    }
  }
  await boot.end();

  const [legacy] = await control`select id from tenants where is_legacy and status <> 'deleted'`;
  legacyId = legacy?.id || null;
  for (const t of await control`select * from tenants where status <> 'deleted'`) await migrate(tenantSql(t));
}

export function tenantSql(t) {
  if (!pools.has(t.id)) pools.set(t.id, connect(t.db_name));
  return pools.get(t.id);
}

export async function getTenant(id) {
  if (!id) return null;
  const c = cache.get(id);
  if (c && Date.now() - c.at < 10_000) return c.t;
  const [t] = await control`select * from tenants where id = ${id}`;
  cache.set(id, { t, at: Date.now() });
  return t || null;
}
export const forget = (id) => cache.delete(id);
/** Sessions issued before multi-tenancy carry no tenant id: they belong to the first company. */
export const legacyTenantId = () => legacyId;

export async function tenantForEmail(email) {
  const [a] = await control`select tenant_id from accounts where email = ${normEmail(email)}`;
  return a ? getTenant(a.tenant_id) : null;
}

/* ---------- users inside a company (keeps the platform-wide login directory in step) ---------- */

async function checkLimit(t, sql) {
  if (!t.max_users) return;
  const [{ n }] = await sql`select count(*)::int as n from users where active`;
  if (n >= t.max_users) throw new HttpError(`Kullanıcı limitine ulaşıldı (${t.max_users} aktif kullanıcı). Limit artırımı için yazılım sağlayıcınızla görüşün.`);
}

export async function createTenantUser(t, { email, name, role, password }, { ignoreLimit = false } = {}) {
  const sql = tenantSql(t);
  email = normEmail(email);
  name = String(name || '').trim();
  if (!EMAIL.test(email)) throw new HttpError('Geçerli bir e-posta girin.');
  if (!name) throw new HttpError('Ad soyad gerekli.');
  const err = validatePassword(password);
  if (err) throw new HttpError(err);
  if (!ignoreLimit) await checkLimit(t, sql);
  const [taken] = await control`select 1 from accounts where email = ${email}`;
  if (taken) throw new HttpError('Bu e-posta ile kayıtlı bir kullanıcı zaten var.');
  const [u] = await sql`
    insert into users (email, name, role, password_hash)
    values (${email}, ${name}, ${role === 'admin' ? 'admin' : 'rep'}, ${await hashPassword(password)}) returning *`;
  try {
    await control`insert into accounts (email, tenant_id, user_id) values (${email}, ${t.id}, ${u.id})`;
  } catch (e) {
    await sql`delete from users where id = ${u.id}`;
    throw new HttpError('Bu e-posta ile kayıtlı bir kullanıcı zaten var.');
  }
  return u;
}

/** Updates a company user. Handles e-mail uniqueness across the platform and the user limit. */
export async function updateTenantUser(t, id, b, { selfId } = {}) {
  const sql = tenantSql(t);
  const [u] = await sql`select * from users where id = ${id}`;
  if (!u) throw new HttpError('Kullanıcı bulunamadı.', 404);
  const self = id === selfId;
  const set = {};
  let bump = false;
  if (b.name !== undefined) { const n = String(b.name).trim(); if (!n) throw new HttpError('Ad soyad gerekli.'); set.name = n; }
  if (b.role !== undefined) {
    if (self && b.role !== 'admin') throw new HttpError('Kendi yönetici yetkinizi kaldıramazsınız.');
    set.role = b.role === 'admin' ? 'admin' : 'rep';
  }
  if (b.active !== undefined) {
    if (self && !b.active) throw new HttpError('Kendi hesabınızı devre dışı bırakamazsınız.');
    if (b.active && !u.active) await checkLimit(t, sql);
    set.active = !!b.active;
    if (!b.active) bump = true;
  }
  if (b.password) {
    const err = validatePassword(b.password);
    if (err) throw new HttpError(err);
    set.password_hash = await hashPassword(b.password);
    bump = true;
  }
  let newEmail = null;
  if (b.email !== undefined && normEmail(b.email) !== u.email) {
    newEmail = normEmail(b.email);
    if (!EMAIL.test(newEmail)) throw new HttpError('Geçerli bir e-posta girin.');
    const [taken] = await control`select 1 from accounts where email = ${newEmail}`;
    if (taken) throw new HttpError('Bu e-posta başka bir kullanıcıda kayıtlı.');
    set.email = newEmail;
  }
  if (!Object.keys(set).length) return u;
  const [updated] = bump
    ? await sql`update users set ${sql(set)}, token_version = token_version + 1 where id = ${id} returning *`
    : await sql`update users set ${sql(set)} where id = ${id} returning *`;
  if (newEmail) {
    await control`delete from accounts where email = ${u.email} and tenant_id = ${t.id}`;
    await control`insert into accounts (email, tenant_id, user_id) values (${newEmail}, ${t.id}, ${id}) on conflict (email) do nothing`;
  }
  return { ...updated, _bumped: bump };
}

/* ---------- companies ---------- */

export async function createTenant({ slug, name, plan, maxUsers, contactName, contactEmail, contactPhone, notes }, admin) {
  slug = String(slug || '').trim().toLowerCase();
  name = String(name || '').trim();
  if (!SLUG.test(slug)) throw new HttpError('Firma kodu 3-30 karakter olmalı; küçük harf ile başlamalı, yalnızca a-z ve 0-9 içermeli.');
  if (!name) throw new HttpError('Firma adı gerekli.');
  const [dup] = await control`select 1 from tenants where slug = ${slug}`;
  if (dup) throw new HttpError('Bu firma kodu kullanılıyor.');
  const adminEmail = normEmail(admin?.email);
  const [taken] = await control`select 1 from accounts where email = ${adminEmail}`;
  if (taken) throw new HttpError('Yönetici e-postası başka bir kullanıcıda kayıtlı.');
  const pwErr = validatePassword(admin?.password);
  if (pwErr) throw new HttpError('Yönetici şifresi: ' + pwErr);
  if (!EMAIL.test(adminEmail) || !String(admin?.name || '').trim()) throw new HttpError('Firma yöneticisinin adı ve e-postası gerekli.');

  const dbName = 'saha_t_' + slug;
  const [dbExists] = await control`select 1 from pg_database where datname = ${dbName}`;
  if (dbExists) throw new HttpError(`"${dbName}" adlı veritabanı zaten var.`);
  await control.unsafe(`create database "${dbName}"`);
  try {
    const [t] = await control`
      insert into tenants (slug, name, db_name, plan, max_users, contact_name, contact_email, contact_phone, notes)
      values (${slug}, ${name}, ${dbName}, ${plan || null}, ${maxUsers || null}, ${contactName || null}, ${contactEmail || null},
        ${contactPhone || null}, ${notes || null}) returning *`;
    await migrate(tenantSql(t));
    const u = await createTenantUser(t, { ...admin, role: 'admin' }, { ignoreLimit: true });
    return { tenant: t, admin: u };
  } catch (e) {
    for (const [id, p] of pools) if (!(await control`select 1 from tenants where id = ${id}`).length) { await p.end(); pools.delete(id); }
    await control`delete from tenants where slug = ${slug}`.catch(() => {});
    await control.unsafe(`drop database if exists "${dbName}" with (force)`).catch(() => {});
    throw e;
  }
}

export async function dropTenant(t) {
  const p = pools.get(t.id);
  if (p) { await p.end({ timeout: 2 }); pools.delete(t.id); }
  await control.unsafe(`drop database if exists "${t.db_name}" with (force)`);
  await control`delete from accounts where tenant_id = ${t.id}`;
  await control`update tenants set status = 'deleted', deleted_at = now(), updated_at = now() where id = ${t.id}`;
  forget(t.id);
  if (legacyId === t.id) legacyId = null;
}

export async function audit(req, action, target, details) {
  const a = req.admin;
  await control`
    insert into audit_log (actor_id, actor_email, ip, action, target, details)
    values (${a?.id || null}, ${a?.email || null}, ${req.ip}, ${action}, ${target || null}, ${details ? control.json(details) : null})`;
}
