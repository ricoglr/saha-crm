import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { PROJECT_STAGES } from '../constants';
import { Chips, Empty, useCustomerMap } from '../components/ui';
import { ProjectRow } from '../components/rows';
import { useForms } from '../components/forms';
import { num } from '../format';
import { Tip } from '../components/Tip';

export default function Projects() {
  const open = useForms();
  const cmap = useCustomerMap();
  const [stage, setStage] = useState('open');
  const projects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const closed = ['kazanildi', 'kaybedildi'];
  const list = projects
    .filter((p) => stage === 'all' || (stage === 'open' ? !closed.includes(p.stage) : p.stage === stage))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const tons = list.reduce((s, p) => s + (p.tonnage || 0), 0);
  return (
    <div className="page">
      <div className="page-head">
        <h1>Yeni projeler</h1>
        <button className="btn primary" onClick={() => open({ type: 'project' })}><Plus size={16} /> Proje</button>
      </div>
      <Tip id="projects">Duyduğunuz yeni şantiyeleri <b>müşteri olmadan da</b> ekleyebilirsiniz. Görüştükçe aşamasını güncelleyin; tahmini tonaj toplamı burada görünür.</Tip>
      <Chips value={stage} onChange={setStage} options={[['open', 'Devam edenler'], ['all', 'Tümü'], ...Object.entries(PROJECT_STAGES)] as [string, string][]} />
      {list.length > 0 && <p className="muted lead">{list.length} proje · toplam tahmini ihtiyaç ~{num(tons)} ton</p>}
      {list.length ? <div className="list">{list.map((p) => <ProjectRow key={p.id} p={p} c={p.customerId ? cmap.get(p.customerId) : undefined} />)}</div>
        : <Empty>Bu aşamada proje yok.</Empty>}
    </div>
  );
}
