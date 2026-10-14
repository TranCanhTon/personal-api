import { useStreaks } from '../api/client'
import { plural } from '../lib/format'

const MAX_DOTS = 7

/** The gym streak as a small pill for the header: a flame, the weeks in a row, and a dot per workout this week. */
export function GymStreak() {
  const { data } = useStreaks()
  const gym = data?.gym
  if (!gym?.target) return null // no workouts-per-week goal, so there is nothing to keep up

  const { current, best, this_week: done, target } = gym
  const dots = Math.min(target, MAX_DOTS)
  const alive = current > 0 || done >= target
  const color = 'var(--fitness)'
  const summary = `Gym streak: ${plural(current, 'week')} in a row. This week ${done} of ${target} workouts. Best ${best}.`

  return (
    <div
      className="group relative flex cursor-default items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-ink-2 outline-none focus-visible:border-white/25"
      tabIndex={0}
      role="img"
      aria-label={summary}
    >
      <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden style={{ color: alive ? color : 'var(--muted)', filter: alive ? `drop-shadow(0 0 5px ${color})` : undefined }}>
        <path
          fill="currentColor"
          d="M12.8 2.2c.3 2.3-.5 4-1.7 5.5C9.8 9.3 8 10.9 8 13.6c0 1.2.4 2.2 1 3-.9-.3-1.7-.9-2.2-1.7C5.5 16.5 6 19.5 8.3 21c1 .7 2.2 1 3.7 1 3.6 0 6-2.5 6-6 0-2.6-1.4-4.2-2.6-5.7-.8 1-1.6 1.6-2.4 1.9.5-2.3.5-5.5-.2-9z"
        />
      </svg>
      <span className="flex items-baseline gap-1">
        <span className="font-semibold text-ink tabular-nums">{current}</span>
        <span className="text-xs">wk</span>
      </span>
      <span className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: dots }, (_, i) => (
          <span
            key={i}
            className="size-1.5 rounded-full"
            style={i < done ? { background: color, boxShadow: `0 0 6px ${color}` } : { background: 'color-mix(in srgb, var(--ink) 18%, transparent)' }}
          />
        ))}
      </span>

      <div className="pointer-events-none absolute top-full right-0 z-30 mt-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs whitespace-nowrap text-ink opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        <div className="font-semibold">{plural(current, 'week')} in a row</div>
        <div className="mt-0.5 text-ink-2">
          This week {done} of {target} workouts · best {best}
        </div>
      </div>
    </div>
  )
}
