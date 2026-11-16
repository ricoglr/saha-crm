import { useEffect, useState, useSyncExternalStore } from 'react';

/** Light / dark / follow-the-OS theme, shared by the sales app and the platform console. */
export type Theme = 'system' | 'light' | 'dark';
const KEY = 'crm-theme';
const subs = new Set<() => void>();

export function getTheme(): Theme {
  try { const t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : 'system'; } catch { return 'system'; }
}
export function applyTheme(t: Theme) {
  const r = document.documentElement;
  if (t === 'system') delete r.dataset.theme; else r.dataset.theme = t;
}
export function setTheme(t: Theme) {
  try { if (t === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* private mode */ }
  applyTheme(t);
  subs.forEach((f) => f());
}
export const useTheme = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, getTheme);

/** Whether the page is currently dark (resolves "system" against the OS setting). */
export function useIsDark() {
  const theme = useTheme();
  const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const [osDark, setOsDark] = useState(!!mq?.matches);
  useEffect(() => {
    if (!mq) return;
    const on = () => setOsDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [mq]);
  return theme === 'dark' || (theme === 'system' && osDark);
}

export const THEME_LABELS: Record<Theme, string> = { system: 'Sistem', light: 'Açık', dark: 'Koyu' };
export const nextTheme = (t: Theme): Theme => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system');

/** Inline <head> script: applies the saved theme before first paint (no flash). */
export const THEME_BOOT = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
