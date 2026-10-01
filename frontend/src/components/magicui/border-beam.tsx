import { motion } from 'motion/react'

type Props = {
  /** Length of the beam in px */
  size?: number
  /** Seconds per lap */
  duration?: number
  colorFrom?: string
  colorTo?: string
  borderWidth?: number
}

/**
 * Magic UI's BorderBeam: a short streak of light that travels around the parent's border.
 * The parent needs `position: relative` and a border radius.
 */
export function BorderBeam({ size = 90, duration = 7, colorFrom = 'var(--ink)', colorTo = 'transparent', borderWidth = 1.5 }: Props) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-transparent"
      style={{
        borderWidth,
        borderStyle: 'solid',
        // Only the border ring shows the beam
        maskImage: 'linear-gradient(transparent, transparent), linear-gradient(#000, #000)',
        maskClip: 'padding-box, border-box',
        maskComposite: 'intersect',
        WebkitMaskImage: 'linear-gradient(transparent, transparent), linear-gradient(#000, #000)',
        WebkitMaskClip: 'padding-box, border-box',
        WebkitMaskComposite: 'source-in',
      }}
    >
      <motion.div
        className="absolute aspect-square"
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
        }}
        initial={{ offsetDistance: '0%' }}
        animate={{ offsetDistance: '100%' }}
        transition={{ repeat: Infinity, ease: 'linear', duration }}
      />
    </div>
  )
}
