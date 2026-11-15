import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { BARTER_STATUS } from '../constants';
import { Chips, Empty, useCustomerMap } from '../components/ui';
import { BarterRow } from '../components/rows';
import { useForms } from '../components/forms';

export default function Barters() {
  const open = useForms();
  const cmap = useCustomerMap();
  const [status, setStatus] = useState('all');
  const barters = useLiveQuery(() => db.barters.toArray(), []) || [];
  const list = barters.filter((b) => status === 'all' || b.status === status).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="page">
      <div className="page-head">
        <h1>Barter teklifleri</h1>
        <button className="btn primary" onClick={() => open({ type: 'barter' })}><Plus size={16} /> Barter</button>
      </div>
      <Chips value={status} onChange={setStatus} options={[['all', 'Tümü'], ...Object.entries(BARTER_STATUS)] as [string, string][]} />
      {list.length ? <div className="list">{list.map((b) => <BarterRow key={b.id} b={b} c={cmap.get(b.customerId)} />)}</div>
        : <Empty>Barter teklifi kaydı yok.</Empty>}
    </div>
  );
}
