import { Monitor, Moon, Sun } from 'lucide-react';
import { nextTheme, setTheme, THEME_LABELS, useTheme, type Theme } from '../theme';

const ICON = { system: Monitor, light: Sun, dark: Moon };

/** Small icon button that cycles Sistem → Açık → Koyu. */
export function ThemeToggle({ className = 'icon-btn', withLabel = false }: { className?: string; withLabel?: boolean }) {
  const t = useTheme();
  const I = ICON[t];
  const label = `Tema: ${THEME_LABELS[t]} (değiştirmek için tıklayın)`;
  return (
    <button className={className} onClick={() => setTheme(nextTheme(t))} title={label} aria-label={label}>
      <I size={16} />{withLabel && <span>{THEME_LABELS[t]}</span>}
    </button>
  );
}

/** Three-way segmented control for settings pages. */
export function ThemeSegment() {
  const t = useTheme();
  return (
    <div className="theme-seg" role="radiogroup" aria-label="Tema">
      {(['system', 'light', 'dark'] as Theme[]).map((k) => {
        const I = ICON[k];
        return (
          <button key={k} role="radio" aria-checked={t === k} className={t === k ? 'on' : ''} onClick={() => setTheme(k)}>
            <I size={15} /> {THEME_LABELS[k]}
          </button>
        );
      })}
    </div>
  );
}
