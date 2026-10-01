import { Popover as PopoverPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

// shadcn/ui Popover (Radix), styled for the dark glass theme

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

export function PopoverContent({ className, align = 'end', sideOffset = 8, ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn('glass z-50 w-72 rounded-2xl p-4 text-ink outline-none', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
