// Interactive: creates (or resets) a COMPANY admin inside an existing company.
// Usually done from the platform panel; this is the command-line fallback.
// Usage: node --env-file=.env scripts/create-admin.js
import readline from 'node:readline';
import { initControl, control, tenantSql, createTenantUser } from '../src/tenants.js';
import { hashPassword, validatePassword } from '../src/auth.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));
function askHidden(q) {
  return new Promise((resolve) => {
    process.stdout.write(q);
    const orig = rl._writeToOutput;
    rl._writeToOutput = () => {};
    rl.question('', (a) => { rl._writeToOutput = orig; process.stdout.write('\n'); resolve(a); });
  });
}

await initControl();
const tenants = await control`select slug, name from tenants where status <> 'deleted' order by created_at`;
console.log('Firmalar: ' + tenants.map((t) => `${t.slug} (${t.name})`).join(', '));
const slug = (await ask('Firma kodu: ')).trim().toLowerCase();
const [t] = await control`select * from tenants where slug = ${slug} and status <> 'deleted'`;
if (!t) { console.log('Firma bulunamadı.'); process.exit(1); }
const email = (await ask('E-posta: ')).trim().toLowerCase();
const name = (await ask('Ad soyad: ')).trim();
let pw;
for (;;) {
  pw = await askHidden('Şifre (en az 8 karakter): ');
  const err = validatePassword(pw);
  if (err) { console.log(err); continue; }
  if ((await askHidden('Şifre (tekrar): ')) !== pw) { console.log('Şifreler aynı değil.'); continue; }
  break;
}
const sql = tenantSql(t);
const [existing] = await sql`select id from users where email = ${email}`;
if (existing) {
  await sql`update users set role = 'admin', active = true, password_hash = ${await hashPassword(pw)}, token_version = token_version + 1 where id = ${existing.id}`;
} else {
  await createTenantUser(t, { email, name: name || email, role: 'admin', password: pw }, { ignoreLimit: true });
}
console.log(`Hazır: ${email} → ${t.name} (yönetici)`);
rl.close();
process.exit(0);
