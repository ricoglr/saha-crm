// Interactive: creates (or resets) a platform admin — the software provider's own login for /platform.
// Usage: node --env-file=.env scripts/create-platform-admin.js
//   (in Docker: docker exec -it saha-crm-api node scripts/create-platform-admin.js)
import readline from 'node:readline';
import { initControl, control } from '../src/tenants.js';
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
const email = (await ask('E-posta: ')).trim().toLowerCase();
const name = (await ask('Ad soyad: ')).trim();
let pw;
for (;;) {
  pw = await askHidden('Şifre (en az 10 karakter): ');
  const err = validatePassword(pw) || (pw.length < 10 ? 'Şifre en az 10 karakter olmalı.' : null);
  if (err) { console.log(err); continue; }
  if ((await askHidden('Şifre (tekrar): ')) !== pw) { console.log('Şifreler aynı değil.'); continue; }
  break;
}
const hash = await hashPassword(pw);
const [a] = await control`
  insert into platform_admins (email, name, password_hash) values (${email}, ${name || email}, ${hash})
  on conflict (email) do update set active = true, password_hash = ${hash},
    name = coalesce(nullif(${name}, ''), platform_admins.name), token_version = platform_admins.token_version + 1
  returning email, name`;
await control`insert into audit_log (actor_email, action, target) values ('cli', 'admin.create', ${a.email})`;
console.log(`Hazır: ${a.name} <${a.email}> (platform yöneticisi)`);
rl.close();
process.exit(0);
