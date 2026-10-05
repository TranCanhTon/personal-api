import { useStreaks } from '../../api/client'
import { StatTile } from '../../components/StatTile'
import { plural } from '../../lib/format'

/** Food logging (days) and gym (weeks with enough workouts), above the Fitness views. Not tied to the period picked. */
export function Streaks() {
  const { data } = useStreaks()
  if (!data) return null
  const { food, gym } = data

  return (
    <div className="mb-4 grid grid-cols-2 gap-3">
      <StatTile
        label="Food logging streak"
        accent="var(--calories)"
        value={plural(food.current, 'day')}
        sub={`Best ${food.best}${food.logged_today ? '' : ' · not logged today yet'}`}
      />
      <StatTile
        label="Gym streak"
        accent="var(--fitness)"
        value={plural(gym.current, 'week')}
        sub={gym.target ? `This week ${gym.this_week} / ${gym.target} · best ${gym.best}` : `Best ${gym.best}`}
        meter={gym.target ? { value: gym.this_week, goal: gym.target } : null}
      />
    </div>
  )
}
