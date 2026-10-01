import type { Day, Workout } from '../api/client'
import { AnimatedValue } from '../components/AnimatedValue'
import { CardTitle } from '../components/ChartCard'
import { MagicCard } from '../components/magicui/magic-card'
import { shortDate } from '../lib/dates'
import { duration, num, time24 } from '../lib/format'

/** Workouts in the given days, newest first, one card each. */
export function Workouts({ days, showDate }: { days: Day[]; showDate: boolean }) {
  const workouts = days
    .flatMap((d) => d.fitness.workouts.map((w) => ({ ...w, date: d.date })))
    .sort((a, b) => b.start_time.localeCompare(a.start_time))

  const totalMin = workouts.reduce((s, w) => s + w.duration_min, 0)

  return (
    <MagicCard color="var(--fitness)">
      <section className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle title="Workouts" accent="var(--fitness)" />
          {workouts.length > 0 && (
            <span className="text-xs text-ink-2 tabular-nums">
              {workouts.length} · {duration(totalMin)}
            </span>
          )}
        </div>
  
        {workouts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No workouts</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {workouts.map((w) => (
              <WorkoutCard key={w.id} workout={w} date={showDate ? w.date : null} />
            ))}
          </ul>
        )}
      </section>
    </MagicCard>
  )
}

function WorkoutCard({ workout: w, date }: { workout: Workout; date: string | null }) {
  const hr = w.heart_rate
  const when = `${date ? `${shortDate(date)} · ` : ''}${time24(w.start_time)}–${time24(w.end_time)}`

  return (
    <li className="rounded-xl border border-line bg-white/[0.025] p-4 transition-colors hover:border-white/15">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-semibold text-ink">{w.type}</span>
        <span className="shrink-0 text-xs text-ink-2 tabular-nums">{when}</span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Duration" value={duration(w.duration_min)} />
        <Stat label="Calories" value={w.calories == null ? null : `${num(w.calories)} kcal`} />
        <Stat
          label="Heart rate"
          value={hr?.avg == null ? null : `${num(hr.avg)} bpm`}
          sub={hr?.min != null || hr?.max != null ? `${hr?.min == null ? '—' : num(hr.min)}–${hr?.max == null ? '—' : num(hr.max)}` : undefined}
        />
      </dl>
    </li>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | null; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] tracking-[0.12em] text-ink-2 uppercase">{label}</dt>
      <dd className={`mt-1 font-display text-base font-semibold tabular-nums ${value == null ? 'text-muted' : 'text-ink'}`}>{value == null ? '—' : <AnimatedValue text={value} />}</dd>
      {sub && <dd className="text-xs text-muted tabular-nums">{sub} bpm</dd>}
    </div>
  )
}