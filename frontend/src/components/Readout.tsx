import { Swatch, type LegendItem } from './ChartCard'

export type ReadoutItem = { label: string; value: string | null; swatch?: Pick<LegendItem, 'color' | 'kind'> }

type Props = {
  /** 'Average', or the hovered day / time */
  title: string
  /** Optional headline on the right, e.g. Asleep 5 h 40 min */
  aside?: { label: string; value: string }
  items: ReadoutItem[]
}

/** Fixed row under a chart: the period's averages, or the hovered day's values. Replaces hover popups. */
export function Readout({ title, aside, items }: Props) {
  return (
    <div className="mt-2 rounded-lg bg-wash px-3 py-2.5" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-ink-2">{title}</span>
        {aside && (
          <span className="text-ink-2">
            {aside.label}{' '}
            {/* key = value, so a new value remounts and replays the animation */}
            <span key={aside.value} className="readout-in font-semibold text-ink tabular-nums">
              {aside.value}
            </span>
          </span>
        )}
      </div>
      <ul className="mt-2 grid gap-2 text-xs" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => (
          <li key={item.label} className="min-w-0">
            <div className="flex items-center gap-1.5 text-ink-2">
              {item.swatch && (
                <span className="flex w-3.5 shrink-0 items-center justify-center">
                  <Swatch item={item.swatch} />
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </div>
            <div className={`mt-0.5 font-semibold tabular-nums ${item.value == null ? 'text-muted' : 'text-ink'}`}>
              <span key={item.value ?? '—'} className="readout-in">
                {item.value ?? '—'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
