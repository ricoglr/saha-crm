import type { ReactNode } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { useAuth } from '../auth';
import { dismissTip, useGuide } from '../guide';

/** A small, dismissible hint shown to users until they close it. */
export function Tip({ id, children }: { id: string; children: ReactNode }) {
  const { user } = useAuth();
  const g = useGuide(user!.id);
  if (!g.tourDone || g.tipsOff || g.dismissed.includes(id)) return null;
  return (
    <div className="tip" role="note">
      <Lightbulb size={16} className="tip-ic" />
      <div className="tip-text"><b>İpucu: </b>{children}</div>
      <button className="icon-btn" onClick={() => dismissTip(id)} aria-label="İpucunu kapat" title="Anladım"><X size={15} /></button>
    </div>
  );
}
