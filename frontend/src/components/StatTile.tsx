type Props = {
  label: string
  value: string
  sub?: string
  /** Progress towards a goal: the bar fits whichever is bigger, with a marker at the goal */
  meter?: { value: number; goal: number } | null
  muted?: boolean
}

export function StatTile({ label, value, sub, meter, muted }: Props) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs text-ink-2">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${muted ? 'text-muted' : 'text-ink'}`}>{value}</div>
      {meter && <GoalMeter {...meter} />}
      {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
    </div>
  )
}

function GoalMeter({ value, goal }: { value: number; goal: number }) {
  const full = Math.max(value, goal)
  const fill = full > 0 ? (value / full) * 100 : 0
  const mark = full > 0 ? (goal / full) * 100 : 0
  return (
    <div className="relative mt-2.5 mb-1" role="img" aria-label={`${Math.round((value / goal) * 100)}% of goal`}>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--series-1) 18%, transparent)' }}>
        <div className="h-full rounded-full" style={{ width: `${fill}%`, background: 'var(--series-1)' }} />
      </div>
      {/* Goal marker: a short tick that stands above and below the bar, ringed in the surface colour */}
      <div
        className="absolute -top-1 h-3.5 w-1 -translate-x-1/2 rounded-full"
        style={{ left: `${mark}%`, background: 'var(--ink)', boxShadow: '0 0 0 2px var(--surface)' }}
      />
    </div>
  )
}
