import postgres from 'postgres';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export const sql = postgres(process.env.DATABASE_URL, {
  max: 5,
  idle_timeout: 30,
  onnotice: () => {},
  types: {
    // keep DATE columns as 'YYYY-MM-DD' strings, NUMERIC as JS numbers
    date: { to: 1082, from: [1082], serialize: (x) => x, parse: (x) => x },
    numeric: { to: 1700, from: [1700], serialize: (x) => String(x), parse: (x) => Number(x) }
  }
});
