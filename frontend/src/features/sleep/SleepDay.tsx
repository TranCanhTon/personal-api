import { motion } from 'motion/react'
import type { Day } from '../../api/client'
import { AnimatedValue } from '../../components/AnimatedValue'
import { CardTitle } from '../../components/ChartCard'
import { Headline } from '../../components/Headline'
import { MagicCard } from '../../components/magicui/magic-card'
import { StatTile } from '../../components/StatTile'
import { duration, NOT_LOGGED, percent, time24 } from '../../lib/format'
import { SleepHeartRateNight } from './SleepHeartRateNight'
import { stages } from './sleepUtils'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

/** One night: the sleep that ended on the morning of this day. */
export function SleepDay({ day }: { day: Day }) {
  const s = day.sleep
  const total = s?.total_min ?? null

  return (
    <div className="space-y-4">
      <Headline label="Time asleep" value={duration(total)} accent="var(--sleep)" muted={total == null} />

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Bedtime" value={time24(s?.bedtime)} accent="var(--schedule)" muted={!s?.bedtime} />
        <StatTile label="Wake time" value={time24(s?.wake_time)} accent="var(--schedule)" muted={!s?.wake_time} />
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
    <MagicCard color="var(--sleep)">
      <section className="p-5">
        <CardTitle title="Sleep stages" accent="var(--sleep)" />
        <p className="mt-1.5 text-sm text-ink-2">{total > 0 ? 'Time in each stage' : NOT_LOGGED}</p>
        {total > 0 && (
          <>
            {/* Part-to-whole bar; segments grow in one after another */}
            <div className="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-full">
              {items
                .filter((x) => x.min)
                .map((x, i) => (
                  <motion.div
                    key={x.key}
                    initial={{ width: 0 }}
                    animate={{ width: `${(x.min! / total) * 100}%` }}
                    transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.15 + i * 0.08 }}
                    style={{ background: x.color, boxShadow: `0 0 12px ${x.color}` }}
                    title={`${x.label} ${duration(x.min)}`}
                  />
                ))}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {items.map((x) => (
                <li key={x.key}>
                  <div className="flex items-center gap-1.5 text-xs text-ink-2">
                    <span className="inline-block size-2.5 rounded-sm" style={{ background: x.color, boxShadow: `0 0 8px ${x.color}` }} />
                    {x.label}
                  </div>
                  <div className="mt-1 font-display text-base font-semibold text-ink">
                    {x.min == null ? NOT_LOGGED : <AnimatedValue text={duration(x.min)} />}
                  </div>
                  <div className="text-xs text-muted">{x.min == null ? '' : percent(x.min, total)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </MagicCard>
  )
}
