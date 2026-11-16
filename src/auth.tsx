import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { openUserDb } from './db';

export type User = { id: string; email: string; name: string; role: 'admin' | 'rep'; company?: string };
type AuthReply = { user: User; tenant?: { name: string } };
const withCompany = (r: AuthReply): User => ({ ...r.user, company: r.tenant?.name });
type Auth = { user: User | null; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>; setUser: (u: User) => void };

const KEY = 'crm-user';
const read = (): User | null => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const write = (u: User | null) => { try { u ? localStorage.setItem(KEY, JSON.stringify(u)) : localStorage.removeItem(KEY); } catch { /* ignore */ } };

const Ctx = createContext<Auth>(null as unknown as Auth);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => {
    const u = read();
    if (u) openUserDb(u.id); // works offline: the last signed-in user opens straight into their local data
    return u;
  });
  const setUser = useCallback((u: User) => { openUserDb(u.id); write(u); setUserState(u); }, []);
  const signOutLocal = useCallback(() => { write(null); setUserState(null); }, []);

  useEffect(() => {
    if (!user) return;
    api<AuthReply>('/api/me').then((r) => setUser(withCompany(r))).catch(() => { /* offline: keep cached user; 401 handled below */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const on = () => signOutLocal();
    window.addEventListener('crm-unauthorized', on);
    return () => window.removeEventListener('crm-unauthorized', on);
  }, [signOutLocal]);

  const login = async (email: string, password: string) => {
    setUser(withCompany(await api<AuthReply>('/api/auth/login', { email, password })));
  };
  const logout = async () => {
    try { await api('/api/auth/logout', {}); } catch { /* offline logout still clears the session locally */ }
    signOutLocal();
  };
  return <Ctx.Provider value={{ user, login, logout, setUser }}>{children}</Ctx.Provider>;
}
