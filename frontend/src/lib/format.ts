export const NOT_LOGGED = 'Not logged'

export function num(value: number | null | undefined, digits = 0): string {
  if (value == null) return NOT_LOGGED
  return value.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function withUnit(value: number | null | undefined, unit: string, digits = 0): string {
  return value == null ? NOT_LOGGED : `${num(value, digits)} ${unit}`
}

/** 372 → '6 h 12 min' */
export function duration(minutes: number | null | undefined): string {
  if (minutes == null) return NOT_LOGGED
  const m = Math.round(minutes)
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return `${rest} min`
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`
}

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** ISO timestamp → '01:30' in the browser's time zone */
export function time24(iso: string | null | undefined): string {
  if (!iso) return NOT_LOGGED
  return clock.format(new Date(iso))
}

/** Mean of the values that exist. Missing days never count as 0. */
export function mean(values: (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => v != null)
  if (present.length === 0) return null
  return present.reduce((a, b) => a + b, 0) / present.length
}

export function sum(values: (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => v != null)
  return present.length ? present.reduce((a, b) => a + b, 0) : null
}

/** Share as a percent; tiny non-zero shares show as '<1%' instead of a misleading '0%' */
export function percent(part: number, whole: number): string {
  if (whole <= 0) return ''
  const p = (part / whole) * 100
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`
}

/** plural(1, 'night') → '1 night', plural(3, 'night') → '3 nights' */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function countPresent(values: unknown[]): number {
  return values.filter((v) => v != null).length
}
