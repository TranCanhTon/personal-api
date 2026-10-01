import { useState } from 'react'
import { useDays } from './api/client'
import { GoalsPanel } from './components/GoalsPanel'
import { PeriodBar } from './components/PeriodBar'
import { ThemeToggle } from './components/ThemeToggle'
import { FitnessDay } from './features/fitness/FitnessDay'
import { FitnessRange } from './features/fitness/FitnessRange'
import { SleepDay } from './features/sleep/SleepDay'
import { SleepRange } from './features/sleep/SleepRange'
import { addDays, todayISO, VIEW_DAYS, windowFor, type View } from './lib/dates'

type Tab = 'fitness' | 'sleep'

const TABS: { value: Tab; label: string }[] = [
  { value: 'fitness', label: 'Fitness' },
  { value: 'sleep', label: 'Sleep' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('fitness')
  const [view, setView] = useState<View>('week')
  // null means "follow today", so a page left open past midnight rolls over by itself
  const [pinnedEnd, setPinnedEnd] = useState<string | null>(null)

  const today = todayISO()
  const end = pinnedEnd ?? today
  const atToday = end >= today
  const { start } = windowFor(view, end)
  const query = useDays(start, end)

  const step = (direction: -1 | 1) => {
    const next = addDays(end, direction * VIEW_DAYS[view])
    setPinnedEnd(next >= today ? null : next)
  }

  const days = query.data
  // While a new period loads, keep showing the previous one, dimmed, instead of flashing empty
  const stale = query.isPlaceholderData

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-ink">Personal Dashboard</h1>
        <div className="flex items-center gap-2">
          <GoalsPanel />
          <ThemeToggle />
        </div>
      </header>

      <nav className="mt-5 flex gap-1 border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              tab === t.value ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-4">
        <PeriodBar
          view={view}
          onView={setView}
          end={end}
          onStep={step}
          onToday={() => setPinnedEnd(null)}
          atToday={atToday}
          refreshing={query.isFetching}
        />
      </div>

      <main className={`mt-5 transition-opacity ${stale ? 'opacity-50' : ''}`} role="tabpanel">
        {query.isError && !days && (
          <div className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
            Can't reach the API. Is the Docker backend running on localhost:8000?
            <div className="mt-1 text-xs text-muted">{String(query.error)}</div>
          </div>
        )}
        {query.isError && days && <p className="mb-3 text-xs text-muted">Couldn't refresh. Showing the last data received.</p>}
        {!days && query.isPending && <p className="text-sm text-muted">Loading…</p>}

        {days &&
          (tab === 'fitness' ? (
            view === 'day' ? (
              <FitnessDay day={days[days.length - 1]} />
            ) : (
              <FitnessRange days={days} />
            )
          ) : view === 'day' ? (
            <SleepDay day={days[days.length - 1]} />
          ) : (
            <SleepRange days={days} />
          ))}
      </main>
    </div>
  )
}
