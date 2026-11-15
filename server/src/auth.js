import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql } from './db.js';

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) throw new Error('JWT_SECRET must be set (min 16 chars)');
const SECURE = process.env.COOKIE_SECURE !== 'false';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days: field reps should not have to log in often

export const hashPassword = (p) => bcrypt.hash(p, 11);
export const checkPassword = (p, h) => bcrypt.compare(p, h);

export function validatePassword(p) {
  if (typeof p !== 'string' || p.length < 8) return 'Şifre en az 8 karakter olmalı.';
  if (p.length > 200) return 'Şifre çok uzun.';
  return null;
}

export function setSession(reply, user) {
  const token = jwt.sign({ uid: user.id, v: user.token_version }, SECRET, { expiresIn: MAX_AGE });
  reply.setCookie('sid', token, { httpOnly: true, secure: SECURE, sameSite: 'lax', path: '/', maxAge: MAX_AGE });
}

export function clearSession(reply) {
  reply.clearCookie('sid', { path: '/' });
}

export const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

/** Fastify preHandler: loads req.user or answers 401 */
export async function requireUser(req, reply) {
  const token = req.cookies.sid;
  let payload;
  try { payload = jwt.verify(token || '', SECRET); } catch { return reply.code(401).send({ error: 'Oturum açmanız gerekiyor.' }); }
  const [u] = await sql`select * from users where id = ${payload.uid}`;
  if (!u || !u.active || u.token_version !== payload.v) {
    clearSession(reply);
    return reply.code(401).send({ error: 'Oturumunuz sona erdi, tekrar giriş yapın.' });
  }
  req.user = u;
}

export async function requireAdmin(req, reply) {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (req.user.role !== 'admin') return reply.code(403).send({ error: 'Bu işlem için yetkiniz yok.' });
}

// very small in-memory brute-force guard: 10 failed attempts / 15 min per ip+email
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
