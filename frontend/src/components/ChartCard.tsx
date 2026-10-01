import { useState, type ReactNode } from 'react'

export type LegendItem = { label: string; color: string; kind: 'bar' | 'line' | 'band' | 'goal' }

type Props = {
  title: string
  summary?: ReactNode
  legend?: LegendItem[]
  table: { head: string[]; rows: string[][] }
  children: ReactNode
  /** Shown under the chart (not the table), e.g. a readout of the hovered day */
  footer?: ReactNode
}

export function Swatch({ item }: { item: Pick<LegendItem, 'color' | 'kind'> }) {
  switch (item.kind) {
    case 'line':
      return <span className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: item.color }} />
    case 'goal':
      return <span className="inline-block w-3.5 border-t border-dashed" style={{ borderColor: item.color }} />
    case 'band':
      return <span className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: item.color, opacity: 0.25 }} />
    default:
      return <span className="inline-block size-2.5 rounded-sm" style={{ background: item.color }} />
  }
}

export function ChartCard({ title, summary, legend = [], table, children, footer }: Props) {
  const [showTable, setShowTable] = useState(false)

  return (
    <section className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {summary && <p className="mt-0.5 text-sm text-ink-2">{summary}</p>}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-ink-2 hover:bg-wash"
          aria-pressed={showTable}
        >
          {showTable ? 'Chart' : 'Table'}
        </button>
      </div>

      {legend.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <Swatch item={item} />
              {item.label}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2">
        {showTable ? (
          <div className="max-h-[260px] overflow-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
                <tr>
                  {table.head.map((h, i) => (
                    <th key={h} className={`py-1.5 font-medium ${i > 0 ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row[0]} className="border-t border-line">
                    {row.map((cell, i) => (
                      <td key={i} className={`py-1.5 ${i > 0 ? 'text-right' : ''} ${cell === 'Not logged' ? 'text-muted' : 'text-ink'}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {children}
            {footer}
          </>
        )}
      </div>
    </section>
  )
}
