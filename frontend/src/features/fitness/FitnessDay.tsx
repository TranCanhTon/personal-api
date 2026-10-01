import { motion } from 'motion/react'
import type { Day } from '../../api/client'
import { AnimatedValue } from '../../components/AnimatedValue'
import { CardTitle } from '../../components/ChartCard'
import { MagicCard } from '../../components/magicui/magic-card'
import { StatTile } from '../../components/StatTile'
import { NOT_LOGGED, num, percent, withUnit } from '../../lib/format'
import { useGoals } from '../../lib/goals'
import { Workouts } from '../Workouts'
import { DayHeartRate } from './DayHeartRate'

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 }
const EASE_OUT = [0.22, 1, 0.36, 1] as const

export function FitnessDay({ day }: { day: Day }) {
  const { goals } = useGoals()
  const f = day.fitness

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Calories in"
          value={withUnit(f.calories_in, 'kcal')}
          accent="var(--calories)"
          meter={f.calories_in != null && goals.caloriesIn ? { value: f.calories_in, goal: goals.caloriesIn } : null}
          muted={f.calories_in == null}
        />
        <StatTile
          label="Steps"
          value={num(f.steps)}
          accent="var(--steps-goal)"
          meter={f.steps != null && goals.steps ? { value: f.steps, goal: goals.steps } : null}
          muted={f.steps == null}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DayHeartRate day={day} />
        <Macros day={day} proteinGoal={goals.proteinG} />
        <Workouts days={[day]} showDate={false} />
      </div>
    </div>
  )
}

function Macros({ day, proteinGoal }: { day: Day; proteinGoal: number | null }) {
  const m = day.fitness.macros
  const items = [
    { key: 'protein' as const, label: 'Protein', grams: m.protein_g ?? null, color: 'var(--protein)' },
    { key: 'carbs' as const, label: 'Carbs', grams: m.carbs_g ?? null, color: 'var(--carbs)' },
    { key: 'fat' as const, label: 'Fat', grams: m.fat_g ?? null, color: 'var(--fat)' },
  ].map((x) => ({ ...x, kcal: x.grams == null ? 0 : x.grams * KCAL_PER_G[x.key] }))
  const totalKcal = items.reduce((s, x) => s + x.kcal, 0)
  const logged = items.some((x) => x.grams != null)
  const protein = m.protein_g ?? null

  return (
    <MagicCard color="var(--protein)">
      <section className="p-5">
        <CardTitle title="Macros" accent="var(--protein)" />
        <p className="mt-1.5 text-sm text-ink-2">{logged ? 'Share of calories from each macro' : NOT_LOGGED}</p>

        {logged && totalKcal > 0 && (
          <>
            {/* Part-to-whole bar; segments grow in and are separated by a 2px gap */}
            <div className="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-full">
              {items
                .filter((x) => x.kcal > 0)
                .map((x, i) => (
                  <motion.div
                    key={x.key}
                    initial={{ width: 0 }}
                    animate={{ width: `${(x.kcal / totalKcal) * 100}%` }}
                    transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.15 + i * 0.08 }}
                    style={{ background: x.color, boxShadow: `0 0 12px ${x.color}` }}
                    title={`${x.label} ${percent(x.kcal, totalKcal)}`}
                  />
                ))}
            </div>
            <ul className="mt-4 grid grid-cols-3 gap-2 text-sm">
              {items.map((x) => (
                <li key={x.key}>
                  <div className="flex items-center gap-1.5 text-xs text-ink-2">
                    <span className="inline-block size-2.5 rounded-sm" style={{ background: x.color, boxShadow: `0 0 8px ${x.color}` }} />
                    {x.label}
                  </div>
                  <div className="mt-1 font-display text-lg font-semibold text-ink">
                    {x.grams == null ? NOT_LOGGED : <AnimatedValue text={withUnit(x.grams, 'g')} />}
                  </div>
                  <div className="text-xs text-muted">{x.grams == null ? '' : `${percent(x.kcal, totalKcal)} · ${num(x.kcal)} kcal`}</div>
                </li>
              ))}
            </ul>
          </>
        )}

        {proteinGoal != null && (
          <div className="mt-5 border-t border-line pt-4">
            <div className="flex justify-between text-xs text-ink-2">
              <span>Protein goal</span>
              <span className="tabular-nums">
                {protein == null ? NOT_LOGGED : `${num(protein)} / ${num(proteinGoal)} g · ${Math.round((protein / proteinGoal) * 100)}%`}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--protein) 15%, transparent)' }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((protein ?? 0) / proteinGoal, 1) * 100}%` }}
                transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.2 }}
                style={{ background: 'var(--protein)', boxShadow: '0 0 12px var(--protein)' }}
              />
            </div>
          </div>
        )}
      </section>
    </MagicCard>
  )
}
