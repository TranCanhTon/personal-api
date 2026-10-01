import { motion } from 'motion/react'
import { useId } from 'react'
import { cn } from '../lib/utils'

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  /** Colour of the sliding pill's glow */
  accent?: string
  size?: 'sm' | 'md'
}

/** Pill-shaped option switcher; the selected pill slides between options. */
export function Segmented<T extends string>({ options, value, onChange, label, accent = 'var(--ink)', size = 'md' }: Props<T>) {
  const id = useId()
  return (
    <div className="glass flex rounded-full p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative rounded-full font-medium transition-colors',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
              active ? 'text-page' : 'text-ink-2 hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`pill-${id}`}
                className="absolute inset-0 rounded-full bg-ink"
                style={{ boxShadow: `0 0 18px color-mix(in srgb, ${accent} 55%, transparent)` }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
