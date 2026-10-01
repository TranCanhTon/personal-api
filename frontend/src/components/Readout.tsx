import { AnimatedValue } from './AnimatedValue'
import { Swatch, type LegendItem } from './ChartCard'

export type ReadoutItem = { label: string; value: string | null; swatch?: Pick<LegendItem, 'color' | 'kind'> }

type Props = {
  /** 'Average', or the hovered day / time */
  title: string
  /** Optional headline on the right, e.g. Asleep 5 h 40 min */
  aside?: { label: string; value: string }
  items: ReadoutItem[]
}

/** Fixed row under a chart: the period's averages, or the hovered day's values. Numbers roll as they change. */
export function Readout({ title, aside, items }: Props) {
  return (
    <div className="mt-3 rounded-xl border border-line bg-white/[0.025] px-4 py-3" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span className="font-medium tracking-[0.12em] text-ink-2 uppercase">{title}</span>
        {aside && (
          <span className="text-ink-2">
            {aside.label}{' '}
            <span className="font-display text-xs font-semibold text-ink tabular-nums">
              <AnimatedValue text={aside.value} />
            </span>
          </span>
        )}
      </div>
      <ul className="mt-2.5 grid gap-3 text-xs" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
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
            <div className={`mt-1 text-sm font-semibold tabular-nums ${item.value == null ? 'text-muted' : 'text-ink'}`}>
              {item.value == null ? '—' : <AnimatedValue text={item.value} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
