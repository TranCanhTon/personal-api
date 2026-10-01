import type { Day } from '../../api/client'
import { StatTile } from '../../components/StatTile'
import { NOT_LOGGED, num, percent, withUnit } from '../../lib/format'
import { useGoals } from '../../lib/goals'
import { Workouts } from '../Workouts'
import { DayHeartRate } from './DayHeartRate'

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 }

export function FitnessDay({ day }: { day: Day }) {
  const { goals } = useGoals()
  const f = day.fitness

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Calories in"
          value={withUnit(f.calories_in, 'kcal')}
          meter={f.calories_in != null && goals.caloriesIn ? { value: f.calories_in, goal: goals.caloriesIn } : null}
          muted={f.calories_in == null}
        />
        <StatTile
          label="Steps"
          value={num(f.steps)}
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
    { key: 'protein' as const, label: 'Protein', grams: m.protein_g ?? null, color: 'var(--series-1)' },
    { key: 'carbs' as const, label: 'Carbs', grams: m.carbs_g ?? null, color: 'var(--series-2)' },
    { key: 'fat' as const, label: 'Fat', grams: m.fat_g ?? null, color: 'var(--series-3)' },
  ].map((x) => ({ ...x, kcal: x.grams == null ? 0 : x.grams * KCAL_PER_G[x.key] }))
  const totalKcal = items.reduce((s, x) => s + x.kcal, 0)
  const logged = items.some((x) => x.grams != null)
  const protein = m.protein_g ?? null

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold text-ink">Macros</h3>
      <p className="mt-0.5 text-sm text-ink-2">{logged ? 'Share of calories from each macro' : NOT_LOGGED}</p>

      {logged && totalKcal > 0 && (
        <>
          {/* Part-to-whole bar; segments separated by a 2px surface gap */}
          <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded">
            {items
              .filter((x) => x.kcal > 0)
              .map((x) => (
                <div key={x.key} style={{ width: `${(x.kcal / totalKcal) * 100}%`, background: x.color }} title={`${x.label} ${percent(x.kcal, totalKcal)}`} />
              ))}
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2 text-sm">
            {items.map((x) => (
              <li key={x.key}>
                <div className="flex items-center gap-1.5 text-xs text-ink-2">
                  <span className="inline-block size-2.5 rounded-sm" style={{ background: x.color }} />
                  {x.label}
                </div>
                <div className="mt-0.5 font-semibold text-ink">{withUnit(x.grams, 'g')}</div>
                <div className="text-xs text-muted">{x.grams == null ? '' : `${percent(x.kcal, totalKcal)} · ${num(x.kcal)} kcal`}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      {proteinGoal != null && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="flex justify-between text-xs text-ink-2">
            <span>Protein goal</span>
            <span className="tabular-nums">
              {protein == null ? NOT_LOGGED : `${num(protein)} / ${num(proteinGoal)} g · ${Math.round((protein / proteinGoal) * 100)}%`}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--series-1) 18%, transparent)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min((protein ?? 0) / proteinGoal, 1) * 100}%`, background: 'var(--series-1)' }} />
          </div>
        </div>
      )}
    </section>
  )
}
