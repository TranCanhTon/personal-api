import type { Day } from '../../api/client'
import { Headline } from '../../components/Headline'
import { StatTile } from '../../components/StatTile'
import { duration, NOT_LOGGED, percent, time24 } from '../../lib/format'
import { SleepHeartRateNight } from './SleepHeartRateNight'
import { stages } from './sleepUtils'

/** One night: the sleep that ended on the morning of this day. */
export function SleepDay({ day }: { day: Day }) {
  const s = day.sleep
  const total = s?.total_min ?? null

  return (
    <div className="space-y-4">
      <Headline label="Time asleep" value={duration(total)} muted={total == null} />

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Bedtime" value={time24(s?.bedtime)} muted={!s?.bedtime} />
        <StatTile label="Wake time" value={time24(s?.wake_time)} muted={!s?.wake_time} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Stages day={day} />
        <SleepHeartRateNight sleep={s ?? null} />
      </div>
    </div>
  )
}

function Stages({ day }: { day: Day }) {
  const s = day.sleep
  const items = stages(null).map((st) => ({ ...st, min: s?.[st.key] ?? null }))
  const total = items.reduce((sum, x) => sum + (x.min ?? 0), 0)

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold text-ink">Sleep stages</h3>
      <p className="mt-0.5 text-sm text-ink-2">{total > 0 ? 'Time in each stage' : NOT_LOGGED}</p>
      {total > 0 && (
        <>
          <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded">
            {items
              .filter((x) => x.min)
              .map((x) => (
                <div key={x.key} style={{ width: `${(x.min! / total) * 100}%`, background: x.color }} title={`${x.label} ${duration(x.min)}`} />
              ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {items.map((x) => (
              <li key={x.key}>
                <div className="flex items-center gap-1.5 text-xs text-ink-2">
                  <span className="inline-block size-2.5 rounded-sm" style={{ background: x.color }} />
                  {x.label}
                </div>
                <div className="mt-0.5 font-semibold text-ink">{duration(x.min)}</div>
                <div className="text-xs text-muted">{x.min == null ? '' : percent(x.min, total)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
