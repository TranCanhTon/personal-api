import { motion } from 'motion/react'
import { AnimatedValue } from './AnimatedValue'
import { MagicCard } from './magicui/magic-card'

type Props = {
  label: string
  value: string
  sub?: string
  /** Area colour (CSS colour or var()) for the number glow, meter and spotlight */
  accent?: string
  /** Progress towards a goal: the bar fits whichever is bigger, with a marker at the goal */
  meter?: { value: number; goal: number } | null
  muted?: boolean
}

export function StatTile({ label, value, sub, accent, meter, muted }: Props) {
  return (
    <MagicCard color={accent}>
      <div className="p-5">
        <div className="text-[11px] font-medium tracking-[0.14em] text-ink-2 uppercase">{label}</div>
        <div
          className={`mt-2 font-display text-2xl font-semibold tracking-tight ${muted ? 'text-muted' : 'neon-text'}`}
          style={{ '--accent': accent } as React.CSSProperties}
        >
          {muted ? value : <AnimatedValue text={value} />}
        </div>
        {meter && <GoalMeter {...meter} color={accent ?? 'var(--ink)'} />}
        {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
      </div>
    </MagicCard>
  )
}

function GoalMeter({ value, goal, color }: { value: number; goal: number; color: string }) {
  const full = Math.max(value, goal)
  const fill = full > 0 ? (value / full) * 100 : 0
  const mark = full > 0 ? (goal / full) * 100 : 0
  return (
    <div className="relative mt-4 mb-1" role="img" aria-label={`${Math.round((value / goal) * 100)}% of goal`}>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${fill}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})`, boxShadow: `0 0 12px ${color}` }}
        />
      </div>
      {/* Goal marker: a short tick that stands above and below the bar, ringed in the surface colour */}
      <div
        className="absolute -top-1 h-3.5 w-1 -translate-x-1/2 rounded-full"
        style={{ left: `${mark}%`, background: 'var(--ink)', boxShadow: '0 0 0 2px var(--surface)' }}
      />
    </div>
  )
}
