import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../auth';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await login(email.trim(), password); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <ThemeToggle className="icon-btn login-theme" />
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <img src="/icon.svg" alt="" />
          <div><b>Saha CRM</b><small>Satış &amp; Pazarlama</small></div>
        </div>
        <h1>Giriş yap</h1>
        <label className="field"><span>E-posta</span>
          <input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
        </label>
        <label className="field"><span>Şifre</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn primary block" disabled={busy}><LogIn size={16} /> {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
        <p className="muted small">Hesabınız yoksa veya şifrenizi unuttuysanız yöneticinize başvurun.</p>
      </form>
    </div>
  );
}
