import { AnimatePresence, motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { MagicCard } from './magicui/magic-card'

export type LegendItem = { label: string; color: string; kind: 'bar' | 'line' | 'band' | 'goal' }

type Props = {
  title: string
  /** The card's area colour (a CSS colour or var()), used for the title dot and the hover spotlight */
  accent?: string
  summary?: ReactNode
  legend?: LegendItem[]
  table: { head: string[]; rows: string[][] }
  children: ReactNode
  /** Shown under the chart (not the table), e.g. a readout of the hovered day */
  footer?: ReactNode
  className?: string
}

export function Swatch({ item }: { item: Pick<LegendItem, 'color' | 'kind'> }) {
  switch (item.kind) {
    case 'line':
      return <span className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
    case 'goal':
      return <span className="inline-block w-3.5 border-t border-dashed" style={{ borderColor: item.color }} />
    case 'band':
      return <span className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: item.color, opacity: 0.35 }} />
    default:
      return <span className="inline-block size-2.5 rounded-sm" style={{ background: item.color, boxShadow: `0 0 8px ${item.color}` }} />
  }
}

/** Title line used by every card: a glowing dot in the area colour and the title in the display font. */
export function CardTitle({ title, accent }: { title: string; accent?: string }) {
  return (
    <h3 className="flex items-center gap-2 font-display text-[11px] font-medium tracking-[0.14em] text-ink uppercase">
      {accent && <span className="size-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} />}
      {title}
    </h3>
  )
}

export function ChartCard({ title, accent, summary, legend = [], table, children, footer, className }: Props) {
  const [showTable, setShowTable] = useState(false)

  return (
    <MagicCard color={accent} className={className}>
      <section className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle title={title} accent={accent} />
            {summary && <p className="mt-1.5 text-sm text-ink-2">{summary}</p>}
          </div>
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-2 transition-colors hover:border-white/20 hover:text-ink"
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
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={showTable ? 'table' : 'chart'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {showTable ? (
                <div className="max-h-[260px] overflow-auto">
                  <table className="w-full text-sm tabular-nums">
                    <thead className="sticky top-0 bg-surface text-left text-[11px] tracking-wide text-muted uppercase">
                      <tr>
                        {table.head.map((h, i) => (
                          <th key={h} className={`py-2 font-medium ${i > 0 ? 'text-right' : ''}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row) => (
                        <tr key={row[0]} className="border-t border-line transition-colors hover:bg-wash">
                          {row.map((cell, i) => (
                            <td key={i} className={`py-2 ${i > 0 ? 'text-right' : ''} ${cell === 'Not logged' ? 'text-muted' : 'text-ink'}`}>
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
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </MagicCard>
  )
}
