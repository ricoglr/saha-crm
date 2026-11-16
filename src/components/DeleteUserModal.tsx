import { useState } from 'react';
import { Trash2, ArrowRightLeft } from 'lucide-react';
import { api } from '../api';
import { Field, Modal, Select } from './primitives';

export type DelUser = { id: string; name: string; email: string; customers?: number; visits?: number };

/**
 * Permanent user deletion with a choice for the user's records: move them to another user (default)
 * or delete them too. Requires typing the user's e-mail. Used by the sales app and the platform console.
 */
export function DeleteUserModal({ user, candidates, defaultTarget, endpoint, onClose, onDeleted }: {
  user: DelUser; candidates: DelUser[]; defaultTarget?: string; endpoint: string; onClose: () => void; onDeleted: (msg: string) => void;
}) {
  const others = candidates.filter((c) => c.id !== user.id);
  const [mode, setMode] = useState<'transfer' | 'delete'>(others.length ? 'transfer' : 'delete');
  const [target, setTarget] = useState(defaultTarget && others.some((o) => o.id === defaultTarget) ? defaultTarget : others[0]?.id || '');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const hasRecords = (user.customers ?? 1) + (user.visits ?? 0) > 0;
  const ok = confirm.trim().toLowerCase() === user.email.toLowerCase() && (mode === 'delete' || !!target);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api<{ counts: Record<string, number>; transferredTo: DelUser | null }>(endpoint, { confirm, transferTo: mode === 'transfer' ? target : null });
      const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
      onDeleted(r.transferredTo
        ? `${user.name} silindi. ${total} kaydı ${r.transferredTo.name} kullanıcısına aktarıldı.`
        : `${user.name} ve ${total} kaydı kalıcı olarak silindi.`);
    } catch (x: any) { setErr(x.message); setBusy(false); }
  };

  return (
    <Modal title="Kullanıcıyı kalıcı olarak sil" onClose={onClose}
      footer={<><span className="grow" /><button type="button" className="btn ghost" onClick={onClose}>Vazgeç</button>
        <button form="del-user" className="btn danger" disabled={!ok || busy}><Trash2 size={15} /> {busy ? 'Siliniyor…' : 'Kalıcı olarak sil'}</button></>}>
      <form id="del-user" className="grid" onSubmit={submit}>
        <p className="full" style={{ margin: 0 }}>
          <b>{user.name}</b> ({user.email}) veritabanından silinecek ve bir daha giriş yapamayacak. <b>Bu işlem geri alınamaz.</b>
          {user.customers !== undefined && <> Kullanıcının <b>{user.customers}</b> müşterisi ve <b>{user.visits ?? 0}</b> görüşmesi var (teklif, proje ve barter kayıtları da dahil edilir).</>}
        </p>
        {hasRecords && (
          <div className="full del-choice">
            <label className={mode === 'transfer' ? 'on' : ''}>
              <input type="radio" checked={mode === 'transfer'} disabled={!others.length} onChange={() => setMode('transfer')} />
              <span><b><ArrowRightLeft size={14} /> Kayıtlarını başka kullanıcıya aktar</b><small>Müşteri, görüşme ve teklifler kaybolmaz; seçtiğiniz kişinin hesabına geçer.</small></span>
            </label>
            {mode === 'transfer' && others.length > 0 && (
              <div className="del-target"><Select value={target} onChange={setTarget} options={Object.fromEntries(others.map((o) => [o.id, `${o.name} (${o.email})`]))} /></div>
            )}
            <label className={mode === 'delete' ? 'on danger' : ''}>
              <input type="radio" checked={mode === 'delete'} onChange={() => setMode('delete')} />
              <span><b><Trash2 size={14} /> Kayıtlarıyla birlikte sil</b><small>Kullanıcının tüm müşteri, görüşme, teklif, proje ve barter kayıtları da kalıcı olarak silinir.</small></span>
            </label>
          </div>
        )}
        <Field label={`Onaylamak için e-postayı yazın: ${user.email}`} full>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoFocus />
        </Field>
        {err && <p className="error full">{err}</p>}
      </form>
    </Modal>
  );
}
