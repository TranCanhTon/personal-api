import { useState } from 'react'
import { useGoals, type Goals, type SaveState } from '../lib/goals'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

const FIELDS: { key: keyof Goals; label: string; unit: string; step: number; color: string }[] = [
  { key: 'steps', label: 'Daily steps', unit: 'steps', step: 500, color: 'var(--steps-goal)' },
  { key: 'caloriesIn', label: 'Calorie intake', unit: 'kcal', step: 50, color: 'var(--calories)' },
  { key: 'proteinG', label: 'Protein', unit: 'g', step: 5, color: 'var(--protein)' },
  { key: 'carbsG', label: 'Carbs', unit: 'g', step: 5, color: 'var(--carbs)' },
  { key: 'fatG', label: 'Fat', unit: 'g', step: 5, color: 'var(--fat)' },
  { key: 'sleepHours', label: 'Sleep', unit: 'h', step: 0.25, color: 'var(--sleep)' },
  { key: 'workoutsPerWeek', label: 'Workouts', unit: '/ week', step: 1, color: 'var(--fitness)' },
]

const STATUS: Record<SaveState, { text: string; tone: string }> = {
  idle: { text: 'Saved to your account. Leave a field empty to switch that goal off.', tone: 'text-muted' },
  saving: { text: 'Saving…', tone: 'text-ink-2' },
  saved: { text: 'Saved.', tone: 'text-ink-2' },
  'bad-key': { text: 'Not saved: the API key is missing or wrong.', tone: 'text-[var(--loss,#fb7185)]' },
  error: { text: "Couldn't save. Try again in a moment.", tone: 'text-[var(--loss,#fb7185)]' },
}

export function GoalsPanel() {
  const { goals, setGoals, saveState, hasKey, setApiKey } = useGoals()
  const [keyDraft, setKeyDraft] = useState('')
  const [editingKey, setEditingKey] = useState(false)

  const update = (key: keyof Goals, raw: string) => {
    const n = raw === '' ? null : Number(raw)
    setGoals({ ...goals, [key]: n != null && Number.isFinite(n) && n > 0 ? n : null })
  }

  const showKeyField = !hasKey || editingKey || saveState === 'bad-key'
  const status = !hasKey && saveState === 'idle' ? { text: 'Add your API key below to save changes.', tone: 'text-muted' } : STATUS[saveState]

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
        <p className={`mt-1 text-xs ${status.tone}`} aria-live="polite">
          {status.text}
        </p>
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
                <span className="w-12 text-xs text-muted">{f.unit}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4 border-t border-line pt-3">
          {showKeyField ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                setApiKey(keyDraft)
                setKeyDraft('')
                setEditingKey(false)
              }}
            >
              <input
                type="password"
                autoComplete="off"
                placeholder="API key (once per device)"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-line bg-black/30 px-2 py-1 text-sm text-ink outline-none focus:border-white/25"
              />
              <button type="submit" disabled={!keyDraft.trim()} className="rounded-full border border-line px-3 py-1 text-xs text-ink-2 transition-colors hover:border-white/20 hover:text-ink disabled:opacity-40">
                Save key
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setEditingKey(true)} className="text-xs text-ink-2 underline-offset-4 hover:text-ink hover:underline">
              Change API key
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
