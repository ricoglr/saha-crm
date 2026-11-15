import { useSyncExternalStore } from 'react';
import { db, TABLE_NAMES, type TableName } from './db';
import { api, ApiError } from './api';

export type SyncState = { status: 'idle' | 'syncing' | 'offline' | 'error'; lastSync?: string; error?: string };
let state: SyncState = { status: 'idle' };
const subs = new Set<() => void>();
const set = (s: Partial<SyncState>) => { state = { ...state, ...s }; subs.forEach((f) => f()); };
export const useSyncState = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);

const FULL_EVERY = 24 * 3600 * 1000;
let running = false;
let again = false;

/** Push queued local changes, then pull everything that changed on the server since last time. */
export async function syncNow(forceFull = false): Promise<void> {
  if (!db) return;
  if (running) { again = true; return; }
  running = true;
  set({ status: 'syncing' });
  try {
    const lastFull = (await db.meta.get('lastFull'))?.v || 0;
    const full = forceFull || Date.now() - lastFull > FULL_EVERY;
    const since = full ? 0 : (await db.meta.get('rev'))?.v || 0;
    const items = await db.outbox.toArray();
    const changes = [];
    for (const it of items) {
      const rec = it.deleted ? undefined : await db.table(it.table).get(it.id);
      if (!rec) { changes.push({ table: it.table, id: it.id, deleted: true }); continue; }
      const data = { ...rec };
      if (it.table === 'regions') { data.id = rec.key; delete data.key; }
      changes.push({ table: it.table, id: it.id, data });
    }
    const res = await api<{ rev: number; changes: Record<TableName, { id: string; deleted?: boolean; data?: any }[]> }>(
      '/api/sync', { since, changes });

    await db.transaction('rw', [...TABLE_NAMES.map((t) => db.table(t)), db.outbox, db.meta], async () => {
      // drop the queue entries we sent, unless they were edited again meanwhile
      for (const it of items) {
        const cur = await db.outbox.get([it.table, it.id]);
        if (cur && cur.n === it.n) await db.outbox.delete([it.table, it.id]);
      }
      const pending = new Set((await db.outbox.toArray()).map((o) => o.table + '|' + o.id));
      for (const t of TABLE_NAMES) {
        const rows = res.changes[t] || [];
        if (full) {
          // full sync: the server copy is authoritative for anything not waiting to be sent
          const keep = new Set(rows.map((r) => r.id));
          const local = (await db.table(t).toCollection().primaryKeys()) as string[];
          const drop = local.filter((k) => !keep.has(k) && !pending.has(t + '|' + k));
          if (drop.length) await db.table(t).bulkDelete(drop);
        }
        for (const r of rows) {
          if (pending.has(t + '|' + r.id)) continue;
          if (r.deleted) { await db.table(t).delete(r.id); continue; }
          const rec = { ...r.data };
          if (t === 'regions') { rec.key = r.id; delete rec.id; }
          await db.table(t).put(rec);
        }
      }
      await db.meta.put({ k: 'rev', v: res.rev });
      if (full) await db.meta.put({ k: 'lastFull', v: Date.now() });
    });
    set({ status: 'idle', lastSync: new Date().toISOString(), error: undefined });
  } catch (e) {
    const err = e as ApiError;
    if (err.status === 0 || !navigator.onLine) set({ status: 'offline', error: undefined });
    else set({ status: err.status === 401 ? 'idle' : 'error', error: err.message });
  } finally {
    running = false;
    if (again) { again = false; setTimeout(() => syncNow(), 200); }
  }
}

/** Starts background syncing for the signed-in user; returns a stop function. */
export function startSync() {
  let t: ReturnType<typeof setTimeout> | undefined;
  const soon = () => { clearTimeout(t); t = setTimeout(() => syncNow(), 800); };
  const onVisible = () => document.visibilityState === 'visible' && syncNow();
  const onOnline = () => syncNow();
  window.addEventListener('crm-local-change', soon);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const iv = setInterval(() => syncNow(), 60_000);
  syncNow();
  return () => {
    clearTimeout(t); clearInterval(iv);
    window.removeEventListener('crm-local-change', soon);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    state = { status: 'idle' };
  };
}
