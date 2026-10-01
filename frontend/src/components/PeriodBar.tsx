import { AnimatePresence, motion } from 'motion/react'
import { periodLabel, type View } from '../lib/dates'
import { Segmented } from './Segmented'

type Props = {
  view: View
  onView: (v: View) => void
  end: string
  onStep: (direction: -1 | 1) => void
  onToday: () => void
  atToday: boolean
  refreshing: boolean
  accent: string
}

const VIEWS: { value: View; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const STEP_LABEL: Record<View, string> = { day: '1 day', week: '7 days', month: '30 days' }

const arrow =
  'grid size-8 place-items-center rounded-full border border-line text-ink-2 transition-colors hover:border-white/20 hover:text-ink disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink-2'

export function PeriodBar({ view, onView, end, onStep, onToday, atToday, refreshing, accent }: Props) {
  const label = periodLabel(view, end)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented options={VIEWS} value={view} onChange={onView} label="Period" accent={accent} />

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onStep(-1)} aria-label={`Back ${STEP_LABEL[view]}`} className={arrow}>
          <Chevron dir="left" />
        </button>
        <div className="min-w-0 overflow-hidden text-sm font-medium text-ink sm:min-w-60 sm:text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={label}
              className="block"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </div>
        <button type="button" onClick={() => onStep(1)} disabled={atToday} aria-label={`Forward ${STEP_LABEL[view]}`} className={arrow}>
          <Chevron dir="right" />
        </button>
      </div>

      <button
        type="button"
        onClick={onToday}
        disabled={atToday}
        className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink-2 transition-colors hover:border-white/20 hover:text-ink disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink-2"
      >
        Today
      </button>

      <span className={`hidden items-center gap-1.5 text-xs text-muted transition-opacity sm:flex ${refreshing ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
        <span className="size-1.5 animate-pulse rounded-full" style={{ background: accent }} />
        Updating
      </span>
    </div>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === 'left' ? 'M10 3 5 8l5 5' : 'm6 3 5 5-5 5'} />
    </svg>
  )
}
