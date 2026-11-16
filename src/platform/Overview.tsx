import { Building2, Users, Database, Plus, Server } from 'lucide-react';
import { api } from '../api';
import { Empty } from '../components/primitives';
import { num } from '../format';
import { bytes, dt, useLoad, ACTIONS, type LogEntry } from './util';

type Stats = {
  tenants: { total: number; active: number; suspended: number }; users: number; activeUsers: number; customers: number; visits: number; quotes: number;
  dbBytes: number; recent: LogEntry[]; server: { node: string; uptime: number; memoryMb: number };
};

export default function Overview() {
  const { data, err } = useLoad(() => api<Stats>('/api/platform/stats'), []);
  return (
    <div className="page">
      <div className="page-head">
        <h1>Genel bakış</h1>
        <a className="btn primary" href="#/firmalar?yeni"><Plus size={16} /> Yeni firma</a>
      </div>
      {err && <div className="notice bad">{err}</div>}
      {data && (
        <>
          <div className="stats">
            <a className="stat" href="#/firmalar"><span className="stat-ic"><Building2 size={18} /></span><span>Firma</span><b>{data.tenants.total}</b><small>{data.tenants.active} aktif · {data.tenants.suspended} askıda</small></a>
            <div className="stat"><span className="stat-ic"><Users size={18} /></span><span>Kullanıcı</span><b>{data.users}</b><small>{data.activeUsers} aktif</small></div>
            <div className="stat"><span>Kayıtlar</span><b>{num(data.customers + data.visits + data.quotes)}</b><small>{num(data.customers)} müşteri · {num(data.visits)} görüşme · {num(data.quotes)} teklif</small></div>
            <div className="stat"><span className="stat-ic"><Database size={18} /></span><span>Veritabanı boyutu</span><b>{bytes(data.dbBytes)}</b><small>tüm firmalar</small></div>
          </div>
          <div className="cols two">
            <section className="card">
              <h3>Son işlemler</h3>
              {data.recent.length ? (
                <div className="log">
                  {data.recent.map((l) => (
                    <div key={l.id} className="log-row"><span className="when">{dt(l.at)}</span><span>{ACTIONS[l.action] || l.action}{l.target && <b> · {l.target}</b>}</span><span className="who">{l.actor_email}</span></div>
                  ))}
                </div>
              ) : <Empty>Henüz işlem yok.</Empty>}
              <a href="#/kayit" className="small">Tüm işlem kaydı →</a>
            </section>
            <section className="card">
              <h3><Server size={14} /> Sunucu</h3>
              <div className="kv">
                <span>API çalışma süresi</span><b>{Math.floor(data.server.uptime / 3600)} sa {Math.floor((data.server.uptime % 3600) / 60)} dk</b>
                <span>API bellek</span><b>{data.server.memoryMb} MB</b>
                <span>Node.js</span><b>{data.server.node}</b>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
