import type { Variants } from 'motion/react'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

/** Parent: reveals its motion children one after another. Variants flow down to nested motion components. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
}

/** Child: rises in from a little below, out of a soft blur. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: EASE_OUT } },
}
