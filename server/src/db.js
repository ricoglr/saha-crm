import postgres from 'postgres';

const BASE = process.env.DATABASE_URL;
if (!BASE) throw new Error('DATABASE_URL is not set');

// keep DATE columns as 'YYYY-MM-DD' strings, NUMERIC as JS numbers
const types = {
  date: { to: 1082, from: [1082], serialize: (x) => x, parse: (x) => x },
  numeric: { to: 1700, from: [1700], serialize: (x) => String(x), parse: (x) => Number(x) }
};

/** The database named in DATABASE_URL (the first company's data before multi-tenancy). */
export const BASE_DB = decodeURIComponent(new URL(BASE).pathname.slice(1));
/** Platform registry: companies, logins directory, platform admins, audit log. */
export const CONTROL_DB = process.env.CONTROL_DB || 'saha_platform';

/** Opens a small pool to another database on the same server, with the same credentials. */
export function connect(dbName, opts = {}) {
  const u = new URL(BASE);
  u.pathname = '/' + encodeURIComponent(dbName);
  return postgres(u.toString(), { max: 3, idle_timeout: 20, onnotice: () => {}, types, ...opts });
}
