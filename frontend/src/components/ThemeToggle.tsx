import { useTheme, type ThemePref } from '../lib/theme'

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ThemeToggle() {
  const { pref, setPref } = useTheme()
  return (
    <div className="flex rounded-lg border border-line bg-surface p-0.5" role="radiogroup" aria-label="Theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={pref === o.value}
          onClick={() => setPref(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs ${pref === o.value ? 'bg-wash font-medium text-ink' : 'text-ink-2 hover:bg-wash'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
