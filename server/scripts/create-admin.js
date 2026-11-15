// Interactive: creates (or promotes) an admin user. The password is typed by the person running it.
// Usage: node --env-file=.env scripts/create-admin.js   (in Docker: docker exec -it saha-crm-api node scripts/create-admin.js)
import readline from 'node:readline';
import { sql } from '../src/db.js';
import { migrate } from '../src/schema.js';
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

await migrate();
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
const hash = await hashPassword(pw);
const [u] = await sql`
  insert into users (email, name, role, password_hash) values (${email}, ${name || email}, 'admin', ${hash})
  on conflict (email) do update set role = 'admin', active = true, password_hash = ${hash},
    name = coalesce(nullif(${name}, ''), users.name), token_version = users.token_version + 1
  returning email, name, role`;
console.log(`Hazır: ${u.name} <${u.email}> (${u.role})`);
rl.close();
await sql.end();
