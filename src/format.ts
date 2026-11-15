const nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
export const num = (n?: number) => (n == null || isNaN(n) ? '' : nf.format(n));
export const money = (n?: number, cur = 'TL') => (n == null || isNaN(n) ? '' : `${nf.format(n)} ${cur}`);
export const date = (s?: string) => {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};
export const daysAgo = (s?: string) => {
  if (!s) return null;
  const ms = new Date().setHours(0, 0, 0, 0) - new Date(s.slice(0, 10) + 'T00:00:00').getTime();
  return Math.round(ms / 86400000);
};
export const relDays = (s?: string) => {
  const d = daysAgo(s);
  if (d == null) return '';
  if (d === 0) return 'bugün';
  if (d === 1) return 'dün';
  if (d === -1) return 'yarın';
  if (d < 0) return `${-d} gün sonra`;
  return `${d} gün önce`;
};
export const trSort = (a: string, b: string) => a.localeCompare(b, 'tr');
export const norm = (s?: string) => (s || '').toLocaleLowerCase('tr');
export const telHref = (p?: string) => 'tel:' + (p || '').replace(/[^\d+]/g, '');
export const waHref = (p?: string) => {
  let d = (p || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10) d = '90' + d;
  return 'https://wa.me/' + d;
};
