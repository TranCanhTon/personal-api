import type { Sleep } from '../../api/client'
import type { Tokens } from '../../lib/theme'

/** Hours since 18:00, so a night reads as one continuous span: 23:00 → 5, 03:25 → 9.4, 08:50 → 14.8. */
export function nightHours(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso)
  const h = d.getHours() + d.getMinutes() / 60
  return h >= 18 ? h - 18 : h + 6
}

/** Back from nightHours to a clock label: 9.4 → '03:24' */
export function nightClock(hours: number | null, wholeHours = false): string {
  if (hours == null) return 'Not logged'
  const total = Math.round(hours * 60)
  const h = (Math.floor(total / 60) + 18) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${wholeHours ? '00' : String(m).padStart(2, '0')}`
}

/** Minutes in bed from bedtime to wake time */
export function inBedMinutes(s: Sleep | null | undefined): number | null {
  if (!s?.bedtime || !s.wake_time) return null
  return (new Date(s.wake_time).getTime() - new Date(s.bedtime).getTime()) / 60_000
}

export function stages(t: Tokens | null) {
  // Deep sits at the bottom of the stack, awake on top
  return [
    { key: 'deep_min' as const, label: 'Deep', color: t ? t['stage-deep'] : 'var(--stage-deep)' },
    { key: 'core_min' as const, label: 'Core', color: t ? t['stage-core'] : 'var(--stage-core)' },
    { key: 'rem_min' as const, label: 'REM', color: t ? t['stage-rem'] : 'var(--stage-rem)' },
    { key: 'awake_min' as const, label: 'Awake', color: t ? t['stage-awake'] : 'var(--stage-awake)' },
  ]
}
