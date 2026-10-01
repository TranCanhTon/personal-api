import { periodLabel, type View } from '../lib/dates'

type Props = {
  view: View
  onView: (v: View) => void
  end: string
  onStep: (direction: -1 | 1) => void
  onToday: () => void
  atToday: boolean
  refreshing: boolean
}

const VIEWS: { value: View; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const STEP_LABEL: Record<View, string> = { day: '1 day', week: '7 days', month: '30 days' }

export function PeriodBar({ view, onView, end, onStep, onToday, atToday, refreshing }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex rounded-lg border border-line bg-surface p-0.5" role="radiogroup" aria-label="Period">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            role="radio"
            aria-checked={view === v.value}
            onClick={() => onView(v.value)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === v.value ? 'bg-ink font-medium text-surface' : 'text-ink-2 hover:bg-wash'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onStep(-1)}
          aria-label={`Back ${STEP_LABEL[view]}`}
          className="rounded-md px-2.5 py-1.5 text-ink-2 hover:bg-wash"
        >
          ◀
        </button>
        <span className="min-w-0 text-sm font-medium text-ink sm:min-w-56 sm:text-center">{periodLabel(view, end)}</span>
        <button
          type="button"
          onClick={() => onStep(1)}
          disabled={atToday}
          aria-label={`Forward ${STEP_LABEL[view]}`}
          className="rounded-md px-2.5 py-1.5 text-ink-2 hover:bg-wash disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ▶
        </button>
      </div>

      <button
        type="button"
        onClick={onToday}
        disabled={atToday}
        className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-2 hover:bg-wash disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Today
      </button>

      <span className={`hidden text-xs text-muted transition-opacity sm:inline ${refreshing ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
        Updating…
      </span>
    </div>
  )
}
