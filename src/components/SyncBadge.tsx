import { useLiveQuery } from 'dexie-react-hooks';
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { db } from '../db';
import { syncNow, useSyncState } from '../sync';

export function SyncBadge({ compact }: { compact?: boolean }) {
  const s = useSyncState();
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const time = s.lastSync ? new Date(s.lastSync).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
  let Icon = Cloud, cls = 'ok', text = time ? `Eşitlendi · ${time}` : 'Eşitleniyor…';
  if (s.status === 'syncing') { Icon = RefreshCw; cls = 'busy'; text = 'Eşitleniyor…'; }
  else if (s.status === 'offline') { Icon = CloudOff; cls = 'warn'; text = pending ? `Çevrimdışı · ${pending} bekliyor` : 'Çevrimdışı'; }
  else if (s.status === 'error') { Icon = AlertTriangle; cls = 'bad'; text = 'Eşitleme hatası'; }
  else if (pending) { cls = 'warn'; text = `${pending} değişiklik bekliyor`; }
  return (
    <button className={'sync ' + cls + (compact ? ' compact' : '')} onClick={() => syncNow(true)} title={s.error || 'Şimdi eşitle'}>
      <Icon size={14} className={s.status === 'syncing' ? 'spin' : ''} /> {(!compact || cls !== 'ok') && <span>{text}</span>}
    </button>
  );
}
