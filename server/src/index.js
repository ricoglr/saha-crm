import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { TABLES, toRow, fromRow, col } from './schema.js';
import {
  hashPassword, checkPassword, validatePassword, setSession, clearSession, publicUser, requireUser, requireAdmin,
  tooManyAttempts, noteFailure, clearFailures
} from './auth.js';
import { initControl, control, tenantForEmail, tenantSql, createTenantUser, updateTenantUser, normEmail } from './tenants.js';
import platformRoutes from './platform.js';

const app = Fastify({ trustProxy: true, bodyLimit: 25 * 1024 * 1024, logger: { level: process.env.LOG_LEVEL || 'warn' } });
await app.register(cookie);

const bad = (reply, msg, code = 400) => reply.code(code).send({ error: msg });

app.setErrorHandler((err, req, reply) => {
  req.log.error(err);
  reply.code(err.statusCode && err.statusCode < 500 ? err.statusCode : 500)
    .send({ error: err.statusCode && err.statusCode < 500 ? err.message : 'Sunucu hatası, lütfen tekrar deneyin.' });
});

app.get('/api/health', async () => {
  await control`select 1`;
  return { ok: true };
});

/* ---------------- auth ---------------- */
app.post('/api/auth/login', async (req, reply) => {
  const email = normEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const key = req.ip + '|' + email;
  if (tooManyAttempts(key)) return bad(reply, 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.', 429);
  const tenant = await tenantForEmail(email);
  const [u] = tenant && tenant.status !== 'deleted' ? await tenantSql(tenant)`select * from users where email = ${email}` : [];
  if (!u || !(await checkPassword(password, u.password_hash))) {
    noteFailure(key);
    return bad(reply, 'E-posta veya şifre hatalı.', 401);
  }
  if (tenant.status === 'suspended') return bad(reply, 'Firmanızın erişimi askıya alındı. Yazılım sağlayıcınızla görüşün.', 403);
  if (!u.active) return bad(reply, 'Hesabınız devre dışı. Yöneticinizle görüşün.', 403);
  clearFailures(key);
  await tenantSql(tenant)`update users set last_login_at = now() where id = ${u.id}`;
  setSession(reply, u, tenant.id);
  return { user: publicUser(u), tenant: { name: tenant.name } };
});

app.post('/api/auth/logout', async (req, reply) => {
  clearSession(reply);
  return { ok: true };
});

app.get('/api/me', { preHandler: requireUser }, async (req) => ({ user: publicUser(req.user), tenant: { name: req.tenant.name } }));

app.post('/api/me/password', { preHandler: requireUser }, async (req, reply) => {
  const { current, next } = req.body || {};
  if (!(await checkPassword(String(current || ''), req.user.password_hash))) return bad(reply, 'Mevcut şifre hatalı.');
  const err = validatePassword(next);
  if (err) return bad(reply, err);
  const [u] = await req.sql`
    update users set password_hash = ${await hashPassword(next)}, token_version = token_version + 1
    where id = ${req.user.id} returning *`;
  setSession(reply, u, req.tenant.id); // this device stays signed in, other devices are signed out
  return { ok: true };
});

/* ---------------- sync ---------------- */
app.post('/api/sync', { preHandler: requireUser }, async (req, reply) => {
  const me = req.user.id;
  const sql = req.sql;
  const since = Math.max(0, Number(req.body?.since) || 0);
  const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];
  if (changes.length > 20000) return bad(reply, 'Çok fazla değişiklik tek seferde gönderildi.');

  await sql.begin(async (tx) => {
    for (const c of changes) {
      if (!TABLES[c?.table] || typeof c.id !== 'string' || !c.id || c.id.length > 100) continue;
      const table = c.table;
      if (c.deleted) {
        await tx`
          insert into ${tx(table)} (owner_id, id, deleted) values (${me}, ${c.id}, true)
          on conflict (owner_id, id) do update set deleted = true, rev = nextval('rev_seq'), updated_at = now()`;
      } else {
        const row = toRow(table, c.data || {});
        await tx`
          insert into ${tx(table)} ${tx({ owner_id: me, id: c.id, deleted: false, ...row })}
          on conflict (owner_id, id) do update set ${tx({ ...row, deleted: false })}, rev = nextval('rev_seq'), updated_at = now()`;
      }
    }
  });

  let rev = since;
  const out = {};
  for (const table of Object.keys(TABLES)) {
    const rows = since === 0
      ? await sql`select * from ${sql(table)} where owner_id = ${me} and not deleted`
      : await sql`select * from ${sql(table)} where owner_id = ${me} and rev > ${since}`;
    out[table] = rows.map((r) => {
      rev = Math.max(rev, Number(r.rev));
      return r.deleted ? { id: r.id, deleted: true } : { id: r.id, data: fromRow(table, r) };
    });
  }
  if (since === 0) {
    const [{ m }] = await sql`select coalesce(max(last_value), 0)::bigint as m from rev_seq`;
    rev = Math.max(rev, Number(m));
  }
  await sql`update users set last_sync_at = now() where id = ${me}`;
  return { rev, changes: out };
});

/* ---------------- admin ---------------- */
app.get('/api/admin/users', { preHandler: requireAdmin }, async (req) => {
  const users = await req.sql`
    select u.id, u.email, u.name, u.role, u.active, u.created_at, u.last_login_at, u.last_sync_at,
      (select count(*) from customers c where c.owner_id = u.id and not c.deleted)::int as customers,
      (select count(*) from visits v where v.owner_id = u.id and not v.deleted)::int as visits
    from users u order by u.active desc, u.name`;
  return { users, maxUsers: req.tenant.max_users };
});

app.post('/api/admin/users', { preHandler: requireAdmin }, async (req) => {
  const u = await createTenantUser(req.tenant, req.body || {});
  return { user: publicUser(u) };
});

app.patch('/api/admin/users/:id', { preHandler: requireAdmin }, async (req, reply) => {
  const u = await updateTenantUser(req.tenant, req.params.id, req.body || {}, { selfId: req.user.id });
  if (u.id === req.user.id && u._bumped) setSession(reply, u, req.tenant.id);
  return { user: publicUser(u) };
});

app.get('/api/admin/overview', { preHandler: requireAdmin }, async (req) => {
  const sql = req.sql;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : '1900-01-01';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : '2999-12-31';
  const reps = await sql`
    select u.id, u.name, u.role, u.active, u.last_sync_at,
      (select count(*) from customers c where c.owner_id = u.id and not c.deleted)::int as customers,
      (select count(*) from customers c where c.owner_id = u.id and not c.deleted and c.status = 'aktif')::int as active_customers,
      (select count(*) from visits v where v.owner_id = u.id and not v.deleted and v.date between ${from} and ${to})::int as visits,
      (select count(*) from visits v where v.owner_id = u.id and not v.deleted and v.kind = 'saha' and v.date between ${from} and ${to})::int as field_visits,
      (select count(*) from visits v where v.owner_id = u.id and not v.deleted and v.kind = 'gelen' and v.date between ${from} and ${to})::int as incoming,
      (select count(*) from quotes q where q.owner_id = u.id and not q.deleted and q.date between ${from} and ${to})::int as quotes,
      (select count(*) from quotes q where q.owner_id = u.id and not q.deleted and q.status = 'tuttu' and q.date between ${from} and ${to})::int as won,
      (select count(*) from quotes q where q.owner_id = u.id and not q.deleted and q.status = 'tutmadi' and q.date between ${from} and ${to})::int as lost,
      (select count(*) from quotes q where q.owner_id = u.id and not q.deleted and q.status = 'beklemede')::int as pending,
      (select count(*) from projects p where p.owner_id = u.id and not p.deleted and p.stage not in ('kazanildi', 'kaybedildi'))::int as open_projects,
      (select count(*) from barters b where b.owner_id = u.id and not b.deleted and b.date between ${from} and ${to})::int as barters,
      (select max(v.date) from visits v where v.owner_id = u.id and not v.deleted) as last_visit
    from users u order by u.active desc, u.name`;
  const lostReasons = await sql`
    select coalesce(lost_reason, 'Belirtilmedi') as reason, count(*)::int as n from quotes
    where not deleted and status = 'tutmadi' and date between ${from} and ${to}
    group by 1 order by 2 desc`;
  const products = await sql`
    select product, count(*)::int as n,
      count(*) filter (where status = 'tuttu')::int as won, count(*) filter (where status = 'tutmadi')::int as lost
    from quotes where not deleted and date between ${from} and ${to} group by 1 order by 2 desc`;
  const cities = await sql`
    select city, count(*)::int as n from visits
    where not deleted and kind = 'saha' and city is not null and date between ${from} and ${to}
    group by 1 order by 2 desc limit 15`;
  return { reps, lostReasons, products, cities };
});

const DATE_FIELD = { visits: 'date', quotes: 'date', barters: 'date', projects: 'start_date', customers: null, regions: null };

app.get('/api/admin/records/:table', { preHandler: requireAdmin }, async (req, reply) => {
  const sql = req.sql;
  const table = req.params.table;
  if (!TABLES[table]) return bad(reply, 'Bilinmeyen tablo.', 404);
  const { owner, q, from, to } = req.query;
  const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 500));
  const hasCustomer = 'customerId' in TABLES[table];
  const textCols = Object.entries(TABLES[table]).filter(([, t]) => t === 'text').map(([f]) => `t."${col(f)}"`);
  const dateCol = DATE_FIELD[table];
  const conds = [sql`not t.deleted`];
  if (owner) conds.push(sql`t.owner_id = ${owner}`);
  if (q) {
    const like = '%' + String(q).replace(/[%_\\]/g, (m) => '\\' + m) + '%';
    conds.push(sql`(concat_ws(' ', ${sql.unsafe(textCols.join(', '))}${hasCustomer ? sql`, c.name` : sql``}) ilike ${like})`);
  }
  if (dateCol && /^\d{4}-\d{2}-\d{2}$/.test(from || '')) conds.push(sql`t.${sql(dateCol)} >= ${from}`);
  if (dateCol && /^\d{4}-\d{2}-\d{2}$/.test(to || '')) conds.push(sql`t.${sql(dateCol)} <= ${to}`);
  const where = conds.reduce((a, c, i) => (i === 0 ? c : sql`${a} and ${c}`));
  const rows = await sql`
    select t.*, u.name as owner_name ${hasCustomer ? sql`, c.name as customer_name` : sql``}
    from ${sql(table)} t
    join users u on u.id = t.owner_id
    ${hasCustomer ? sql`left join customers c on c.owner_id = t.owner_id and c.id = t.customer_id` : sql``}
    where ${where}
    order by ${dateCol ? sql`t.${sql(dateCol)} desc nulls last,` : sql``} t.updated_at desc
    limit ${limit}`;
  return {
    rows: rows.map((r) => ({
      ...fromRow(table, r), ownerId: r.owner_id, ownerName: r.owner_name, customerName: r.customer_name, updatedAt: r.updated_at
    }))
  };
});

await app.register(platformRoutes, { prefix: '/api/platform' });

await initControl();
const port = Number(process.env.PORT || 3000);
await app.listen({ port, host: '0.0.0.0' });
console.log(`saha-crm api listening on :${port}`);
