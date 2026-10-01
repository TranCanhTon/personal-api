import { motion } from 'motion/react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { useId, type ComponentProps } from 'react'
import { cn } from '../../lib/utils'

// shadcn/ui Tabs (Radix), with an underline that slides to the active tab

export const Tabs = TabsPrimitive.Root
export const TabsContent = TabsPrimitive.Content

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex gap-6 border-b border-line', className)} {...props} />
}

type TriggerProps = ComponentProps<typeof TabsPrimitive.Trigger> & { active: boolean; accent: string; group?: string }

export function TabsTrigger({ className, active, accent, group, children, ...props }: TriggerProps) {
  const fallback = useId()
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative -mb-px pb-3 font-display text-xs font-medium tracking-[0.16em] uppercase transition-colors outline-none',
        active ? 'text-ink' : 'text-muted hover:text-ink-2',
        className,
      )}
      {...props}
    >
      {children}
      {active && (
        <motion.span
          layoutId={`tab-underline-${group ?? fallback}`}
          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
          style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
    </TabsPrimitive.Trigger>
  )
}
