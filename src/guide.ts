import { useSyncExternalStore } from 'react';

/** Per-user, per-device state of the welcome tour and page tips (kept in localStorage). */
type GuideState = { tourDone: boolean; tipsOff: boolean; dismissed: string[] };
const EMPTY: GuideState = { tourDone: false, tipsOff: false, dismissed: [] };

let uid = '';
let state: GuideState = EMPTY;
const subs = new Set<() => void>();
const key = () => 'crm-guide-' + uid;

function load() {
  try { state = { ...EMPTY, ...JSON.parse(localStorage.getItem(key()) || '{}') }; } catch { state = EMPTY; }
}
function update(p: Partial<GuideState>) {
  state = { ...state, ...p };
  try { localStorage.setItem(key(), JSON.stringify(state)); } catch { /* private mode: only for this session */ }
  subs.forEach((f) => f());
}

export function useGuide(userId: string) {
  if (uid !== userId) { uid = userId; load(); }
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
}

export const finishTour = () => update({ tourDone: true });
export const replayTour = () => update({ tourDone: false });
export const dismissTip = (id: string) => update({ dismissed: [...new Set([...state.dismissed, id])] });
export const resetTips = () => update({ dismissed: [], tipsOff: false });
export const setTipsOff = (tipsOff: boolean) => update({ tipsOff });

/* ---------- install prompt (Android / desktop Chrome) ---------- */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let installEvent: InstallEvent | null = null;
const installSubs = new Set<() => void>();
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallEvent;
    installSubs.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => { installEvent = null; installSubs.forEach((f) => f()); });
}
export const useInstallPrompt = () =>
  useSyncExternalStore((f) => { installSubs.add(f); return () => installSubs.delete(f); }, () => installEvent);
export async function promptInstall() {
  if (!installEvent) return false;
  await installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  installSubs.forEach((f) => f());
  return outcome === 'accepted';
}

export type Platform = 'ios' | 'android' | 'desktop';
export function platform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}
export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
