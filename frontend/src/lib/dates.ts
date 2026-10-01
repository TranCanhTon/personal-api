// Dates are handled as 'YYYY-MM-DD' strings, like the API. Arithmetic runs in UTC so DST never shifts a day.

export type View = 'day' | 'week' | 'month'

export const VIEW_DAYS: Record<View, number> = { day: 1, week: 7, month: 30 }

export function todayISO(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The window of days a view covers, ending on `end`. */
export function windowFor(view: View, end: string): { start: string; end: string } {
  return { start: addDays(end, -(VIEW_DAYS[view] - 1)), end }
}

function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

/** 'Tue 30 Sep' (axis ticks, table rows) */
export function shortDate(iso: string): string {
  return utc(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** 'Tuesday' (tooltip headers; the date itself is on the axis) */
export function weekday(iso: string): string {
  return utc(iso).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
}

/** '29' (axis ticks; the month is in the period bar above) */
export function dayNumber(iso: string): string {
  return String(Number(iso.slice(8, 10)))
}

/** '30 Sep' */
export function dayMonth(iso: string): string {
  return utc(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** 'Tuesday 30 September 2026' */
export function longDate(iso: string): string {
  return utc(iso).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Label for the period bar: one day, or '24 Sep – 30 Sep 2026'. */
export function periodLabel(view: View, end: string): string {
  if (view === 'day') return longDate(end)
  const { start } = windowFor(view, end)
  const year = end.slice(0, 4)
  const startLabel = start.slice(0, 4) === year ? dayMonth(start) : `${dayMonth(start)} ${start.slice(0, 4)}`
  return `${startLabel} – ${dayMonth(end)} ${year}`
}
