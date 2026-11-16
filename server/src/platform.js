// Platform (software provider) API: manage companies, their databases and platform admins.
import {
  checkPassword, hashPassword, validatePassword, setPlatformSession, clearPlatformSession, requirePlatform,
  tooManyAttempts, noteFailure, clearFailures
} from './auth.js';
import {
  control, getTenant, forget, tenantSql, createTenant, dropTenant, createTenantUser, updateTenantUser, audit, normEmail, HttpError
} from './tenants.js';
import { TABLES } from './schema.js';

const pub = (a) => ({ id: a.id, email: a.email, name: a.name });

/** Usage figures read from a company's own database. */
async function usage(t) {
  if (t.status === 'deleted') return null;
  try {
    const sql = tenantSql(t);
    const [r] = await sql`
      select
        (select count(*) from users)::int as users,
        (select count(*) from users where active)::int as active_users,
        (select count(*) from customers where not deleted)::int as customers,
        (select count(*) from visits where not deleted)::int as visits,
        (select count(*) from quotes where not deleted)::int as quotes,
        (select max(last_sync_at) from users) as last_activity,
        pg_database_size(current_database())::bigint as db_bytes`;
    return { ...r, db_bytes: Number(r.db_bytes) };
  } catch (e) {
    return { error: e.message };
  }
}

async function loadTenant(req) {
  const t = await getTenant(req.params.id);
  if (!t || t.status === 'deleted') throw new HttpError('Firma bulunamadı.', 404);
  return t;
}

export default async function platformRoutes(app) {
  /* ---------- auth ---------- */
  app.post('/auth/login', async (req, reply) => {
    const email = normEmail(req.body?.email);
    const key = 'p|' + req.ip + '|' + email;
    if (tooManyAttempts(key)) return reply.code(429).send({ error: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.' });
    const [a] = await control`select * from platform_admins where email = ${email}`;
    if (!a || !(await checkPassword(String(req.body?.password || ''), a.password_hash))) {
      noteFailure(key);
      return reply.code(401).send({ error: 'E-posta veya şifre hatalı.' });
    }
    if (!a.active) return reply.code(403).send({ error: 'Hesabınız devre dışı.' });
    clearFailures(key);
    await control`update platform_admins set last_login_at = now() where id = ${a.id}`;
    setPlatformSession(reply, a);
    req.admin = a;
    await audit(req, 'login');
    return { admin: pub(a) };
  });

  app.post('/auth/logout', async (req, reply) => { clearPlatformSession(reply); return { ok: true }; });

  // everything below needs a platform admin
  app.addHook('preHandler', async (req, reply) => {
    if (req.routeOptions.url?.endsWith('/auth/login') || req.routeOptions.url?.endsWith('/auth/logout')) return;
    await requirePlatform(req, reply);
  });

  app.get('/me', async (req) => ({ admin: pub(req.admin) }));

  app.post('/me/password', async (req, reply) => {
    const { current, next } = req.body || {};
    if (!(await checkPassword(String(current || ''), req.admin.password_hash))) throw new HttpError('Mevcut şifre hatalı.');
    const err = validatePassword(next);
    if (err || String(next).length < 10) throw new HttpError(err || 'Platform yöneticisi şifresi en az 10 karakter olmalı.');
    const [a] = await control`
      update platform_admins set password_hash = ${await hashPassword(next)}, token_version = token_version + 1
      where id = ${req.admin.id} returning *`;
    setPlatformSession(reply, a);
    await audit(req, 'password.change', req.admin.email);
    return { ok: true };
  });

  /* ---------- overview ---------- */
  app.get('/stats', async () => {
    const tenants = await control`select * from tenants where status <> 'deleted'`;
    const u = await Promise.all(tenants.map(usage));
    const sum = (k) => u.reduce((a, x) => a + (x && !x.error ? Number(x[k]) || 0 : 0), 0);
    const recent = await control`select * from audit_log order by id desc limit 8`;
    return {
      tenants: { total: tenants.length, active: tenants.filter((t) => t.status === 'active').length, suspended: tenants.filter((t) => t.status === 'suspended').length },
      users: sum('users'), activeUsers: sum('active_users'), customers: sum('customers'), visits: sum('visits'), quotes: sum('quotes'),
      dbBytes: sum('db_bytes'), recent,
      server: { node: process.version, uptime: Math.round(process.uptime()), memoryMb: Math.round(process.memoryUsage().rss / 1048576) }
    };
  });

  /* ---------- companies ---------- */
  app.get('/tenants', async () => {
    const tenants = await control`select * from tenants where status <> 'deleted' order by created_at`;
    const u = await Promise.all(tenants.map(usage));
    return { tenants: tenants.map((t, i) => ({ ...t, usage: u[i] })) };
  });

  app.post('/tenants', async (req) => {
    const b = req.body || {};
    const { tenant, admin } = await createTenant({
      slug: b.slug, name: b.name, plan: b.plan, maxUsers: Number(b.maxUsers) || null,
      contactName: b.contactName, contactEmail: b.contactEmail, contactPhone: b.contactPhone, notes: b.notes
    }, b.admin || {});
    await audit(req, 'tenant.create', tenant.slug, { name: tenant.name, db: tenant.db_name, admin: admin.email });
    return { tenant };
  });

  app.get('/tenants/:id', async (req) => {
    const t = await loadTenant(req);
    const users = await tenantSql(t)`
      select id, email, name, role, active, created_at, last_login_at, last_sync_at from users order by role, name`;
    const log = await control`select * from audit_log where target = ${t.slug} order by id desc limit 30`;
    return { tenant: t, usage: await usage(t), users, log };
  });

  app.patch('/tenants/:id', async (req) => {
    const t = await loadTenant(req);
    const b = req.body || {};
    const set = {};
    for (const [k, c] of [['name', 'name'], ['plan', 'plan'], ['contactName', 'contact_name'], ['contactEmail', 'contact_email'], ['contactPhone', 'contact_phone'], ['notes', 'notes']]) {
      if (b[k] !== undefined) set[c] = String(b[k]).trim() || null;
    }
    if (set.name === null) throw new HttpError('Firma adı gerekli.');
    if (b.maxUsers !== undefined) set.max_users = Number(b.maxUsers) > 0 ? Math.floor(Number(b.maxUsers)) : null;
    if (b.status !== undefined) {
      if (!['active', 'suspended'].includes(b.status)) throw new HttpError('Geçersiz durum.');
      set.status = b.status;
    }
    if (!Object.keys(set).length) return { tenant: t };
    const [u] = await control`update tenants set ${control(set)}, updated_at = now() where id = ${t.id} returning *`;
    forget(t.id);
    await audit(req, b.status && b.status !== t.status ? (b.status === 'suspended' ? 'tenant.suspend' : 'tenant.activate') : 'tenant.update', t.slug, set);
    return { tenant: u };
  });

  app.post('/tenants/:id/users', async (req) => {
    const t = await loadTenant(req);
    const u = await createTenantUser(t, req.body || {}, { ignoreLimit: true });
    await audit(req, 'user.create', t.slug, { email: u.email, role: u.role });
    return { user: { id: u.id, email: u.email, name: u.name, role: u.role } };
  });

  app.patch('/tenants/:id/users/:uid', async (req) => {
    const t = await loadTenant(req);
    const b = req.body || {};
    const u = await updateTenantUser(t, req.params.uid, b);
    const what = [b.password && 'şifre', b.active !== undefined && (b.active ? 'aktif' : 'devre dışı'), b.role && `yetki: ${b.role}`, b.email && 'e-posta', b.name && 'ad'].filter(Boolean);
    await audit(req, 'user.update', t.slug, { email: u.email, changes: what });
    return { user: { id: u.id, email: u.email, name: u.name, role: u.role, active: u.active } };
  });

  app.get('/tenants/:id/export', async (req, reply) => {
    const t = await loadTenant(req);
    const sql = tenantSql(t);
    const out = { app: 'saha-crm', kind: 'tenant-backup', version: 1, exportedAt: new Date().toISOString(), tenant: t, users: await sql`select * from users` };
    for (const table of Object.keys(TABLES)) out[table] = await sql`select * from ${sql(table)}`;
    await audit(req, 'tenant.export', t.slug);
    reply.header('content-disposition', `attachment; filename="saha-crm-${t.slug}-${out.exportedAt.slice(0, 10)}.json"`);
    return out;
  });

  app.post('/tenants/:id/delete', async (req) => {
    const t = await loadTenant(req);
    if (String(req.body?.confirm || '') !== t.slug) throw new HttpError('Onay için firma kodunu aynen yazın.');
    if (!(await checkPassword(String(req.body?.password || ''), req.admin.password_hash))) throw new HttpError('Şifreniz hatalı.');
    await dropTenant(t);
    await audit(req, 'tenant.delete', t.slug, { name: t.name, db: t.db_name });
    return { ok: true };
  });

  /* ---------- platform admins ---------- */
  app.get('/admins', async () => ({
    admins: await control`select id, email, name, active, created_at, last_login_at from platform_admins order by created_at`
  }));

  app.post('/admins', async (req) => {
    const email = normEmail(req.body?.email);
    const name = String(req.body?.name || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) throw new HttpError('Ad ve geçerli bir e-posta gerekli.');
    const err = validatePassword(req.body?.password);
    if (err || String(req.body.password).length < 10) throw new HttpError(err || 'Platform yöneticisi şifresi en az 10 karakter olmalı.');
    const [dup] = await control`select 1 from platform_admins where email = ${email}`;
    if (dup) throw new HttpError('Bu e-posta ile bir platform yöneticisi var.');
    const [a] = await control`
      insert into platform_admins (email, name, password_hash) values (${email}, ${name}, ${await hashPassword(req.body.password)}) returning *`;
    await audit(req, 'admin.create', email);
    return { admin: pub(a) };
  });

  app.patch('/admins/:id', async (req) => {
    const b = req.body || {};
    const [a] = await control`select * from platform_admins where id = ${req.params.id}`;
    if (!a) throw new HttpError('Yönetici bulunamadı.', 404);
    const set = {};
    let bump = false;
    if (b.active !== undefined) {
      if (a.id === req.admin.id && !b.active) throw new HttpError('Kendi hesabınızı devre dışı bırakamazsınız.');
      set.active = !!b.active; if (!b.active) bump = true;
    }
    if (b.password) {
      const err = validatePassword(b.password);
      if (err || String(b.password).length < 10) throw new HttpError(err || 'Platform yöneticisi şifresi en az 10 karakter olmalı.');
      set.password_hash = await hashPassword(b.password); bump = true;
    }
    if (!Object.keys(set).length) return { ok: true };
    bump
      ? await control`update platform_admins set ${control(set)}, token_version = token_version + 1 where id = ${a.id}`
      : await control`update platform_admins set ${control(set)} where id = ${a.id}`;
    await audit(req, 'admin.update', a.email, { changes: Object.keys(set).map((k) => (k === 'password_hash' ? 'şifre' : k)) });
    return { ok: true };
  });

  /* ---------- audit ---------- */
  app.get('/audit', async (req) => {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    return { log: await control`select * from audit_log order by id desc limit ${limit}` };
  });
}
