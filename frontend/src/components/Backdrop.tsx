import { motion } from 'motion/react'

/** Fixed glow behind the page: blurred blobs of the current tab's colours, drifting slowly. */
export function Backdrop({ colors }: { colors: [string, string, string] }) {
  const blobs = [
    { color: colors[0], className: 'left-[-10%] top-[-15%] h-[55vh] w-[55vw]', drift: { x: [0, 60, -20, 0], y: [0, 40, 80, 0] }, duration: 26 },
    { color: colors[1], className: 'right-[-15%] top-[20%] h-[50vh] w-[45vw]', drift: { x: [0, -50, 30, 0], y: [0, 60, -30, 0] }, duration: 32 },
    { color: colors[2], className: 'bottom-[-20%] left-[25%] h-[50vh] w-[50vw]', drift: { x: [0, 40, -60, 0], y: [0, -40, 20, 0] }, duration: 38 },
  ]
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-[110px] ${b.className}`}
          animate={{ ...b.drift, backgroundColor: b.color }}
          initial={{ backgroundColor: b.color }}
          style={{ opacity: 0.16 }}
          transition={{
            x: { duration: b.duration, repeat: Infinity, ease: 'easeInOut' },
            y: { duration: b.duration, repeat: Infinity, ease: 'easeInOut' },
            backgroundColor: { duration: 1.2, ease: 'easeInOut' },
          }}
        />
      ))}
      {/* Darken the edges so the glow sits behind the content, not over it */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--page)_95%)]" />
    </div>
  )
}
