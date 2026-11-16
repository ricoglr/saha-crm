// Creates two fictional demo companies with realistic data in a LOCAL development setup.
// Usage: npm run seed:demo        (refuses to run when NODE_ENV=production)
// Platform panel (/platform): platform@demo.local / platform1234
// Company "Demo Demir Çelik" (password demo1234): yonetici@demo.local (admin), ayse@ / murat@ / emre@demo.local
// Company "Anadolu Metal"    (password demo1234): admin@anadolu.demo (admin), satis@anadolu.demo
import { initControl, control, createTenant, createTenantUser, dropTenant, tenantSql } from '../src/tenants.js';
import { hashPassword } from '../src/auth.js';
import { randomUUID } from 'node:crypto';

if (process.env.NODE_ENV === 'production') { console.error('Refusing to seed demo data in production.'); process.exit(1); }

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const day = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.toISOString().slice(0, 10); };

const KONYA = ['Selçuklu', 'Meram', 'Karatay', 'Ereğli', 'Akşehir', 'Beyşehir', 'Çumra', 'Ilgın', 'Seydişehir', 'Cihanbeyli', 'Kulu', 'Karapınar'];
const OTHER = [['Aksaray', 'Merkez'], ['Karaman', 'Merkez'], ['Niğde', 'Bor'], ['Afyonkarahisar', 'Bolvadin'], ['Antalya', 'Manavgat']];
const PREFIX = ['Akyıldız', 'Kuzeyler', 'Ova', 'Anadolu', 'Toros', 'Ulu', 'Mevlana', 'Konevi', 'Sille', 'Alaeddin', 'Takkeli', 'Hisar', 'Gökçe', 'Bereket', 'Tekin'];
const KIND = [['Yapı', 'Müteahhit / İnşaat Firması'], ['İnşaat', 'Müteahhit / İnşaat Firması'], ['Yapı Market', 'Bayi / Nalbur'], ['Nalbur', 'Bayi / Nalbur'],
  ['Metal Sanayi', 'Sanayi / İmalatçı'], ['Makina', 'Sanayi / İmalatçı'], ['Demir Çelik', 'Demir-Çelik Tüccarı'], ['Yapı Koop.', 'Kooperatif']];
const PEOPLE = ['Ahmet', 'Mehmet', 'Hüseyin', 'Mustafa', 'Ali', 'Hasan', 'İbrahim', 'Osman', 'Yusuf', 'Fatma', 'Zeynep', 'Elif'];
const SURN = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kılıç', 'Koç', 'Kurt'];
const PRODUCTS = [['İnşaat Demiri (Nervürlü)', 'Ø12-16 B500C', 'ton', 23500, 26500], ['Hasır Çelik', 'Q257', 'ton', 26000, 29000],
  ['Sac Levha - Siyah (HRP)', '3 mm', 'ton', 27000, 31000], ['Sac Levha - DKP', '1,5 mm', 'ton', 30000, 34000],
  ['Rulo - Sıcak Haddelenmiş', '2-6 mm', 'ton', 26000, 29500], ['Galvaniz Sac', '0,8 mm', 'ton', 36000, 41000], ['Kutu Profil / Profil', '40x40x2', 'ton', 31000, 35000]];
const SUBJECTS = ['Yeni şantiye demir ihtiyacı', 'Aylık sac siparişi', 'Fiyat görüşmesi', 'Tahsilat ve vade', 'Yeni proje duyumu', 'Tanışma ziyareti', 'Numune ve kalite', 'Rulo stok durumu'];
const NOTES = ['Haftaya kesin miktar verecek.', 'Rakip firmadan da teklif almışlar, fiyatı takip et.', 'Peşin ödemede indirim istedi.',
  'Şantiye Mart’ta başlıyor, ilk etap ~200 ton.', 'Depo stoklarını görmek için ofise gelecek.', 'Memnunlar, düzenli alım devam ediyor.'];
const LOST = ['Fiyat yüksek bulundu', 'Rakip daha ucuz verdi', 'Rakip daha ucuz verdi', 'Vade / ödeme şartı uymadı', 'Teslim süresi uzun', 'Nakliye maliyeti'];

await initControl();
for (const slug of ['demo', 'anadolu']) {
  const [t] = await control`select * from tenants where slug = ${slug} and status <> 'deleted'`;
  if (t) await dropTenant(t);
  await control`delete from tenants where slug = ${slug}`;
}
await control`delete from audit_log`;
await control`
  insert into platform_admins (email, name, password_hash) values ('platform@demo.local', 'Platform Demo', ${await hashPassword('platform1234')})
  on conflict (email) do nothing`;

async function company(slug, name, extra, people) {
  const { tenant } = await createTenant({ slug, name, ...extra }, { email: people[0][0], name: people[0][1], password: 'demo1234' });
  const ids = [];
  const sql = tenantSql(tenant);
  for (const [i, [email, pname, role]] of people.entries()) {
    const u = i === 0 ? (await sql`select * from users where email = ${email}`)[0] : await createTenantUser(tenant, { email, name: pname, role, password: 'demo1234' }, { ignoreLimit: true });
    await sql`update users set last_login_at = now() - interval '2 hours', last_sync_at = now() - make_interval(mins => ${int(1, 40)}) where id = ${u.id}`;
    ids.push(u.id);
  }
  await control`insert into audit_log (actor_email, action, target, details) values ('platform@demo.local', 'tenant.create', ${slug}, ${control.json({ name })})`;
  return { sql, ids };
}

const users = [['yonetici@demo.local', 'Selim Aksoy', 'admin'], ['ayse@demo.local', 'Ayşe Demirtaş', 'rep'],
  ['murat@demo.local', 'Murat Şener', 'rep'], ['emre@demo.local', 'Emre Kocabaş', 'rep']];
const demo = await company('demo', 'Demo Demir Çelik A.Ş.', { plan: 'Kurumsal', maxUsers: 10, contactName: 'Selim Aksoy', contactEmail: 'yonetici@demo.local', contactPhone: '0332 000 00 00' }, users);
const anadolu = await company('anadolu', 'Anadolu Metal Ltd. Şti.', { plan: 'Başlangıç', maxUsers: 3, contactName: 'Kemal Ateş', contactEmail: 'admin@anadolu.demo' },
  [['admin@anadolu.demo', 'Kemal Ateş', 'admin'], ['satis@anadolu.demo', 'Deniz Ok', 'rep']]);

let counts = { customers: 0, visits: 0, quotes: 0, projects: 0, barters: 0 };
for (const { sql, ids } of [demo, anadolu])
for (const [ui, owner] of ids.entries()) {
  const nCust = ui === 0 ? 4 : int(9, 14);
  const custs = [];
  for (let i = 0; i < nCust; i++) {
    const [k, group] = pick(KIND);
    const loc = rnd() < 0.8 ? ['Konya', pick(KONYA)] : pick(OTHER);
    const c = {
      owner_id: owner, id: randomUUID(), name: `${pick(PREFIX)} ${k}`, contact: `${pick(PEOPLE)} ${pick(SURN)}`,
      phone: `05${int(30, 55)} ${int(100, 999)} ${int(10, 99)} ${int(10, 99)}`, group: undefined, grp: group,
      status: pick(['aktif', 'aktif', 'potansiyel', 'potansiyel', 'pasif']), city: loc[0], district: loc[1],
      created_at: new Date(Date.now() - int(30, 200) * 864e5), client_updated_at: new Date()
    };
    delete c.group;
    await sql`insert into customers ${sql(c)}`;
    custs.push(c); counts.customers++;
  }
  for (const c of custs) {
    for (let v = 0, n = int(1, 6); v < n; v++) {
      const back = int(0, 85);
      const kind = pick(['saha', 'saha', 'saha', 'telefon', 'gelen']);
      await sql`insert into visits ${sql({
        owner_id: owner, id: randomUUID(), customer_id: c.id, date: day(back), kind, city: c.city, district: c.district,
        subject: pick(SUBJECTS), notes: pick(NOTES), next_date: back < 10 && rnd() < 0.5 ? day(back - int(2, 12)) : null, created_at: new Date()
      })}`;
      counts.visits++;
    }
    for (let q = 0, n = int(0, 3); q < n; q++) {
      const [product, spec, unit, lo, hi] = pick(PRODUCTS);
      const back = int(0, 80);
      const status = back < 7 ? 'beklemede' : pick(['tuttu', 'tuttu', 'tutmadi', 'tutmadi', 'beklemede']);
      const price = Math.round((lo + rnd() * (hi - lo)) / 50) * 50;
      await sql`insert into quotes ${sql({
        owner_id: owner, id: randomUUID(), customer_id: c.id, date: day(back), product, spec, quantity: int(5, 60) * 5, unit,
        price, currency: 'TL', payment_term: pick(['Peşin', '30 gün', '60 gün çek', '45 gün']), status,
        lost_reason: status === 'tutmadi' ? pick(LOST) : null,
        competitor_price: status === 'tutmadi' && rnd() < 0.6 ? price - int(4, 20) * 50 : null, created_at: new Date()
      })}`;
      counts.quotes++;
    }
  }
  for (let p = 0, n = ui === 0 ? 1 : int(1, 3); p < n; p++) {
    const c = pick(custs);
    await sql`insert into projects ${sql({
      owner_id: owner, id: randomUUID(), name: `${c.district} ${int(4, 30) * 10} konutluk site`, customer_id: c.id, city: c.city, district: c.district,
      stage: pick(['duyum', 'gorusme', 'teklif', 'pazarlik', 'kazanildi']), tonnage: int(10, 120) * 10, contractor: c.name,
      start_date: day(-int(10, 120)), created_at: new Date(), client_updated_at: new Date()
    })}`;
    counts.projects++;
  }
  if (ui > 0) {
    const c = pick(custs);
    await sql`insert into barters ${sql({
      owner_id: owner, id: randomUUID(), customer_id: c.id, date: day(int(3, 40)), offer_type: 'Daire / Konut',
      offered: `${c.district} 3+1 daire, ${int(110, 160)} m²`, offered_value: int(35, 60) * 100000, wanted: 'İnşaat Demiri (Nervürlü)',
      quantity: `${int(8, 20) * 10} ton`, status: pick(['degerlendiriliyor', 'kabul', 'red']), created_at: new Date()
    })}`;
    counts.barters++;
  }
}
console.log('Demo data ready:', counts);
console.log('Platform: platform@demo.local / platform1234 · company logins (demo1234): ' + users.map((u) => u[0]).join(', ') + ', admin@anadolu.demo, satis@anadolu.demo');
process.exit(0);
