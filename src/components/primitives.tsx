import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/* Shared UI primitives (used by the sales app and the platform panel). */

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.classList.add('noscroll');
    return () => { window.removeEventListener('keydown', k); document.body.classList.remove('noscroll'); };
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={'field' + (full ? ' full' : '')}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Select({ value, onChange, options, empty }: { value?: string; onChange: (v: string) => void; options: Record<string, string> | string[]; empty?: string }) {
  const entries = Array.isArray(options) ? options.map((o) => [o, o]) : Object.entries(options);
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {entries.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="chips">
      {options.map(([k, l]) => (
        <button key={k} className={value === k ? 'chip on' : 'chip'} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}
