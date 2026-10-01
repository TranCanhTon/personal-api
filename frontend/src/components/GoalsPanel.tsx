import { useEffect, useRef, useState } from 'react'
import { DEFAULT_GOALS, useGoals, type Goals } from '../lib/goals'

const FIELDS: { key: keyof Goals; label: string; unit: string; step: number }[] = [
  { key: 'steps', label: 'Daily steps', unit: 'steps', step: 500 },
  { key: 'caloriesIn', label: 'Calorie intake', unit: 'kcal', step: 50 },
  { key: 'proteinG', label: 'Protein', unit: 'g', step: 5 },
  { key: 'sleepHours', label: 'Sleep', unit: 'h', step: 0.25 },
]

export function GoalsPanel() {
  const { goals, setGoals } = useGoals()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const update = (key: keyof Goals, raw: string) => {
    const n = raw === '' ? null : Number(raw)
    setGoals({ ...goals, [key]: n != null && Number.isFinite(n) && n > 0 ? n : null })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-2 hover:bg-wash"
      >
        Goals
      </button>
      {open && (
        // On phones the button sits at the left, on wider screens at the right; open towards the free space
        <div className="absolute left-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-4 shadow-lg sm:right-0 sm:left-auto">
          <p className="text-xs text-muted">Saved in this browser. Leave a field empty to hide that goal line.</p>
          <div className="mt-3 space-y-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-3 text-sm text-ink">
                {f.label}
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={f.step}
                    value={goals[f.key] ?? ''}
                    onChange={(e) => update(f.key, e.target.value)}
                    className="w-24 rounded-md border border-line bg-page px-2 py-1 text-right tabular-nums text-ink"
                  />
                  <span className="w-9 text-xs text-muted">{f.unit}</span>
                </span>
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setGoals(DEFAULT_GOALS)} className="mt-4 text-xs text-ink-2 underline hover:text-ink">
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  )
}
