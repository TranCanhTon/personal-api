import { motion } from 'motion/react'
import { useState } from 'react'
import { useChess, useDays } from './api/client'
import { Backdrop } from './components/Backdrop'
import { GoalsPanel } from './components/GoalsPanel'
import { PeriodBar } from './components/PeriodBar'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { ChessView, PAGE_SIZE } from './features/chess/ChessView'
import { FitnessDay } from './features/fitness/FitnessDay'
import { FitnessRange } from './features/fitness/FitnessRange'
import { Streaks } from './features/fitness/Streaks'
import { SleepDay } from './features/sleep/SleepDay'
import { SleepRange } from './features/sleep/SleepRange'
import { addDays, todayISO, VIEW_DAYS, windowFor, type View } from './lib/dates'
import { stagger } from './lib/motion'
import { useTheme } from './lib/theme'

type Tab = 'fitness' | 'sleep' | 'chess'

const TABS: { value: Tab; label: string }[] = [
  { value: 'fitness', label: 'Fitness' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'chess', label: 'Chess' },
]

export default function App() {
  const { tokens: t } = useTheme()
  const [tab, setTab] = useState<Tab>('fitness')
  const [view, setView] = useState<View>('week')
  // null means "follow today", so a page left open past midnight rolls over by itself
  const [pinnedEnd, setPinnedEnd] = useState<string | null>(null)

  const today = todayISO()
  const end = pinnedEnd ?? today
  const atToday = end >= today
  const { start } = windowFor(view, end)
  const chessTab = tab === 'chess'
  const [chessLimit, setChessLimit] = useState(PAGE_SIZE)
  const daysQuery = useDays(start, end, !chessTab)
  const chessQuery = useChess(chessLimit, chessTab)
  const query = chessTab ? chessQuery : daysQuery

  const step = (direction: -1 | 1) => {
    const next = addDays(end, direction * VIEW_DAYS[view])
    setPinnedEnd(next >= today ? null : next)
  }

  const days = chessTab ? undefined : daysQuery.data
  const chess = chessTab ? chessQuery.data : undefined
  const data = days ?? chess
  // While a new period loads, keep showing the previous one, dimmed, instead of flashing empty
  const stale = query.isPlaceholderData

  const accent = { fitness: t.fitness, sleep: t.sleep, chess: t.chess }[tab]
  const glow: [string, string, string] = {
    fitness: [t.calories, t['steps-goal'], t.heart] as [string, string, string],
    sleep: [t.sleep, t['stage-deep'], t['stage-rem']] as [string, string, string],
    chess: [t.chess, t.win, t.carbs] as [string, string, string],
  }[tab]

  return (
    <>
      <Backdrop colors={glow} />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
            <span className="bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">Personal</span>{' '}
            <motion.span
              className="bg-clip-text text-transparent"
              animate={{ backgroundImage: `linear-gradient(90deg, ${accent}, ${glow[1]})` }}
              transition={{ duration: 0.8 }}
            >
              Dashboard
            </motion.span>
          </h1>
          <GoalsPanel />
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-6">
          <TabsList>
            {TABS.map((x) => (
              <TabsTrigger key={x.value} value={x.value} active={tab === x.value} accent={accent} group="main">
                {x.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Chess shows totals over every saved game, so it has no period to pick */}
        {!chessTab && (
          <div className="mt-5">
            <PeriodBar
              view={view}
              onView={setView}
              end={end}
              onStep={step}
              onToday={() => setPinnedEnd(null)}
              atToday={atToday}
              refreshing={query.isFetching}
              accent={accent}
            />
          </div>
        )}

        <main className={`mt-6 transition-opacity ${stale ? 'opacity-50' : ''}`} role="tabpanel">
          {query.isError && !data && (
            <div className="glass rounded-2xl p-5 text-sm text-ink-2">
              Can't reach the API.
              <div className="mt-1 text-xs text-muted">{String(query.error)}</div>
            </div>
          )}
          {query.isError && data && <p className="mb-3 text-xs text-muted">Couldn't refresh. Showing the last data received.</p>}
          {!data && query.isPending && <p className="text-sm text-muted">Loading…</p>}

          {chess && (
            <motion.div key="chess" variants={stagger} initial="hidden" animate="show">
              <ChessView chess={chess} onMore={() => setChessLimit((n) => n + PAGE_SIZE)} loadingMore={chessQuery.isFetching} />
            </motion.div>
          )}

          {days && (
            // Re-keyed per tab and view, so the cards rise in again one after another
            <motion.div key={`${tab}-${view}`} variants={stagger} initial="hidden" animate="show">
              {tab === 'fitness' ? (
                <>
                  <Streaks />
                  {view === 'day' ? <FitnessDay day={days[days.length - 1]} /> : <FitnessRange days={days} />}
                </>
              ) : view === 'day' ? (
                <SleepDay day={days[days.length - 1]} />
              ) : (
                <SleepRange days={days} />
              )}
            </motion.div>
          )}
        </main>
      </div>
    </>
  )
}
