import { DEFAULT_GOALS, useGoals, type Goals } from '../lib/goals'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

const FIELDS: { key: keyof Goals; label: string; unit: string; step: number; color: string }[] = [
  { key: 'steps', label: 'Daily steps', unit: 'steps', step: 500, color: 'var(--steps-goal)' },
  { key: 'caloriesIn', label: 'Calorie intake', unit: 'kcal', step: 50, color: 'var(--calories)' },
  { key: 'proteinG', label: 'Protein', unit: 'g', step: 5, color: 'var(--protein)' },
  { key: 'sleepHours', label: 'Sleep', unit: 'h', step: 0.25, color: 'var(--sleep)' },
]

export function GoalsPanel() {
  const { goals, setGoals } = useGoals()

  const update = (key: keyof Goals, raw: string) => {
    const n = raw === '' ? null : Number(raw)
    setGoals({ ...goals, [key]: n != null && Number.isFinite(n) && n > 0 ? n : null })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-2 transition-colors hover:border-white/20 hover:text-ink data-[state=open]:border-white/25 data-[state=open]:text-ink"
        >
          Goals
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="font-display text-[11px] font-medium tracking-[0.16em] uppercase">Goals</div>
        <p className="mt-1 text-xs text-muted">Saved in this browser. Leave a field empty to hide that goal.</p>
        <div className="mt-4 space-y-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-3 text-sm text-ink">
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full" style={{ background: f.color, boxShadow: `0 0 8px ${f.color}` }} />
                {f.label}
              </span>
              <span className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={f.step}
                  value={goals[f.key] ?? ''}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="w-24 rounded-lg border border-line bg-black/30 px-2 py-1 text-right text-ink tabular-nums outline-none focus:border-white/25"
                />
                <span className="w-9 text-xs text-muted">{f.unit}</span>
              </span>
            </label>
          ))}
        </div>
        <button type="button" onClick={() => setGoals(DEFAULT_GOALS)} className="mt-4 text-xs text-ink-2 underline-offset-4 hover:text-ink hover:underline">
          Reset to defaults
        </button>
      </PopoverContent>
    </Popover>
  )
}
