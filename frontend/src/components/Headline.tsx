import { motion } from 'motion/react'
import { rise } from '../lib/motion'
import { AnimatedValue } from './AnimatedValue'
import { BorderBeam } from './magicui/border-beam'

/** The one number a view leads with, e.g. 'Time asleep / 5 h 57 min', on a glass card with a travelling light beam. */
export function Headline({ label, value, muted, accent = 'var(--ink)' }: { label: string; value: string; muted?: boolean; accent?: string }) {
  return (
    <motion.div variants={rise} className="glass relative overflow-hidden rounded-2xl px-6 py-5">
      {/* Soft wash of the area colour from the left */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, ${accent} 14%, transparent), transparent 60%)` }}
      />
      <div className="relative">
        <div className="text-[11px] font-medium tracking-[0.18em] text-ink-2 uppercase">{label}</div>
        <div
          className={`mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl ${muted ? 'text-muted' : 'neon-text'}`}
          style={{ '--accent': accent } as React.CSSProperties}
        >
          {muted ? value : <AnimatedValue text={value} />}
        </div>
      </div>
      <BorderBeam colorFrom={accent} size={120} duration={8} />
    </motion.div>
  )
}
