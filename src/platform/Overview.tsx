import { Building2, Users, Database, Plus, Activity, Cpu } from 'lucide-react';
import { api } from '../api';
import { num } from '../format';
import { bytes, useLoad, type LogEntry } from './util';
import { Terminal } from './ui';

type Stats = {
  tenants: { total: number; active: number; suspended: number }; users: number; activeUsers: number; customers: number; visits: number; quotes: number;
  dbBytes: number; recent: LogEntry[]; server: { node: string; uptime: number; memoryMb: number };
};
const up = (s: number) => `${Math.floor(s / 86400)}g ${Math.floor((s % 86400) / 3600)}s ${Math.floor((s % 3600) / 60)}d`;

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
            <a className="stat" href="#/firmalar"><span className="stat-ic"><Building2 size={16} /></span><span>firmalar</span><b>{data.tenants.total}</b><small><span className="okc">{data.tenants.active} active</span> · <span className="warnc">{data.tenants.suspended} suspended</span></small></a>
            <div className="stat"><span className="stat-ic"><Users size={16} /></span><span>kullanıcılar</span><b>{data.users}</b><small>{data.activeUsers} aktif</small></div>
            <div className="stat"><span className="stat-ic"><Activity size={16} /></span><span>kayıtlar</span><b>{num(data.customers + data.visits + data.quotes)}</b><small>{num(data.customers)} müş · {num(data.visits)} gör · {num(data.quotes)} tek</small></div>
            <div className="stat"><span className="stat-ic"><Database size={16} /></span><span>disk</span><b>{bytes(data.dbBytes)}</b><small>{data.tenants.total} veritabanı</small></div>
          </div>
          <div className="cols two">
            <Terminal log={data.recent} title="tail -n 8 audit.log" />
            <section className="card">
              <h3><Cpu size={14} /> sistem</h3>
              <div className="kv mono-kv">
                <span>status</span><b className="okc">● çalışıyor</b>
                <span>uptime</span><b>{up(data.server.uptime)}</b>
                <span>memory</span><b>{data.server.memoryMb} MB rss</b>
                <span>runtime</span><b>node {data.server.node}</b>
                <span>tenancy</span><b>database-per-tenant</b>
              </div>
              <a href="#/kayit" className="small">→ işlem kaydının tamamı</a>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
