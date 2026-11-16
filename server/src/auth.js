import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { control, getTenant, tenantSql, legacyTenantId } from './tenants.js';

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) throw new Error('JWT_SECRET must be set (min 16 chars)');
const SECURE = process.env.COOKIE_SECURE !== 'false';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days: field reps should not have to log in often
const PLATFORM_MAX_AGE = 60 * 60 * 12; // platform admins: 12 hours

export const hashPassword = (p) => bcrypt.hash(p, 11);
export const checkPassword = (p, h) => bcrypt.compare(p, h);

export function validatePassword(p) {
  if (typeof p !== 'string' || p.length < 8) return 'Şifre en az 8 karakter olmalı.';
  if (p.length > 200) return 'Şifre çok uzun.';
  return null;
}

const cookieOpts = (maxAge) => ({ httpOnly: true, secure: SECURE, sameSite: 'lax', path: '/', maxAge });

/* ---------------- company users ---------------- */

export function setSession(reply, user, tenantId) {
  const token = jwt.sign({ uid: user.id, tid: tenantId, v: user.token_version }, SECRET, { expiresIn: MAX_AGE });
  reply.setCookie('sid', token, cookieOpts(MAX_AGE));
}
export const clearSession = (reply) => reply.clearCookie('sid', { path: '/' });
export const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

/** Loads req.tenant, req.sql (that company's database) and req.user, or answers 401. */
export async function requireUser(req, reply) {
  let p;
  try { p = jwt.verify(req.cookies.sid || '', SECRET); } catch { return reply.code(401).send({ error: 'Oturum açmanız gerekiyor.' }); }
  if (p.scope) return reply.code(401).send({ error: 'Oturum açmanız gerekiyor.' });
  const tenant = await getTenant(p.tid || legacyTenantId());
  if (!tenant || tenant.status !== 'active') {
    clearSession(reply);
    return reply.code(401).send({ error: tenant?.status === 'suspended' ? 'Firmanızın erişimi askıya alındı. Yazılım sağlayıcınızla görüşün.' : 'Oturumunuz sona erdi, tekrar giriş yapın.' });
  }
  const sql = tenantSql(tenant);
  const [u] = await sql`select * from users where id = ${p.uid}`;
  if (!u || !u.active || u.token_version !== p.v) {
    clearSession(reply);
    return reply.code(401).send({ error: 'Oturumunuz sona erdi, tekrar giriş yapın.' });
  }
  req.tenant = tenant; req.sql = sql; req.user = u;
}

export async function requireAdmin(req, reply) {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (req.user.role !== 'admin') return reply.code(403).send({ error: 'Bu işlem için yetkiniz yok.' });
}

/* ---------------- platform admins (software provider) ---------------- */

export function setPlatformSession(reply, a) {
  const token = jwt.sign({ pid: a.id, v: a.token_version, scope: 'platform' }, SECRET, { expiresIn: PLATFORM_MAX_AGE });
  reply.setCookie('psid', token, cookieOpts(PLATFORM_MAX_AGE));
}
export const clearPlatformSession = (reply) => reply.clearCookie('psid', { path: '/' });

export async function requirePlatform(req, reply) {
  let p;
  try { p = jwt.verify(req.cookies.psid || '', SECRET); } catch { return reply.code(401).send({ error: 'Oturum açmanız gerekiyor.' }); }
  if (p.scope !== 'platform') return reply.code(401).send({ error: 'Oturum açmanız gerekiyor.' });
  const [a] = await control`select * from platform_admins where id = ${p.pid}`;
  if (!a || !a.active || a.token_version !== p.v) {
    clearPlatformSession(reply);
    return reply.code(401).send({ error: 'Oturumunuz sona erdi, tekrar giriş yapın.' });
  }
  req.admin = a;
}

// small in-memory brute-force guard: 10 failed attempts / 15 min per key
const fails = new Map();
export function tooManyAttempts(key) {
  const f = fails.get(key);
  if (!f) return false;
  if (Date.now() - f.first > 15 * 60 * 1000) { fails.delete(key); return false; }
  return f.count >= 10;
}
export function noteFailure(key) {
  const f = fails.get(key);
  if (!f || Date.now() - f.first > 15 * 60 * 1000) fails.set(key, { first: Date.now(), count: 1 });
  else f.count++;
}
export const clearFailures = (key) => fails.delete(key);
