import { motion, useMotionTemplate, useMotionValue } from 'motion/react'
import type { PointerEvent, ReactNode } from 'react'
import { rise } from '../../lib/motion'
import { cn } from '../../lib/utils'

type Props = {
  children: ReactNode
  className?: string
  /** CSS colour (a var() works) for the spotlight and the border highlight */
  color?: string
  size?: number
}

/**
 * Magic UI's MagicCard: a glass card with a soft spotlight that follows the pointer,
 * and a brighter rim where the spotlight touches the border.
 */
export function MagicCard({ children, className, color = 'var(--ink)', size = 280 }: Props) {
  const x = useMotionValue(-size)
  const y = useMotionValue(-size)

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    x.set(e.clientX - rect.left)
    y.set(e.clientY - rect.top)
  }
  const onLeave = () => {
    x.set(-size)
    y.set(-size)
  }

  const fill = useMotionTemplate`radial-gradient(${size}px circle at ${x}px ${y}px, color-mix(in srgb, ${color} 12%, transparent), transparent 70%)`
  const rim = useMotionTemplate`radial-gradient(${size * 0.75}px circle at ${x}px ${y}px, color-mix(in srgb, ${color} 70%, transparent), transparent 70%)`

  return (
    <motion.div
      variants={rise}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn('glass group relative min-w-0 rounded-2xl', className)}
    >
      {/* Spotlight on the card face */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: fill }}
      />
      {/* The same spotlight, masked to a 1px ring so the border lights up */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: rim,
          padding: 1,
          mask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
        }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  )
}
