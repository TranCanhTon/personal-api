// Shared building blocks so every chart has the same axes, tooltip, goal line and "not logged" look.
import type { CustomSeriesRenderItem } from 'echarts'
import type { ChartOption } from '../components/EChart'
import { dayNumber } from './dates'
import type { Tokens } from './theme'

export type TooltipLine = { color?: string; label: string; value: string }

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

export function tooltipHtml(t: Tokens, title: string, lines: TooltipLine[]): string {
  const rows = lines
    .map((l) => {
      const swatch = l.color
        ? `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${l.color};margin-right:6px"></span>`
        : '<span style="display:inline-block;width:14px"></span>'
      return `<div style="display:flex;justify-content:space-between;gap:16px;line-height:1.6">
        <span style="color:${t['ink-2']}">${swatch}${escapeHtml(l.label)}</span>
        <span style="color:${t.ink};font-weight:600;font-variant-numeric:tabular-nums">${escapeHtml(l.value)}</span>
      </div>`
    })
    .join('')
  return `<div style="min-width:160px"><div style="color:${t.ink};font-weight:600;margin-bottom:4px">${escapeHtml(title)}</div>${rows}</div>`
}

type BaseArgs = {
  t: Tokens
  dates: string[]
  /** Build tooltip content for the day at this index */
  tooltip: (index: number) => string
  pointer?: 'line' | 'shadow'
  yAxis?: Record<string, unknown>
  /** Keep the hover highlight but no popup, for charts that show the hovered day elsewhere */
  hideTooltip?: boolean
}

/** Grid, axes and tooltip shared by every range chart. Series are added by the caller. */
export function baseOption({ t, dates, tooltip, pointer = 'line', yAxis = {}, hideTooltip = false }: BaseArgs): ChartOption {
  return {
    animationDuration: 300,
    grid: { left: 4, right: 12, top: 28, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
      axisLabel: { color: t.muted, formatter: dayNumber, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: t.grid, width: 1 } },
      axisLabel: { color: t.muted },
      ...yAxis,
    },
    tooltip: {
      trigger: 'axis',
      showContent: !hideTooltip,
      confine: true,
      backgroundColor: t.surface,
      borderColor: t.border,
      borderWidth: 1,
      padding: [8, 12],
      extraCssText: 'box-shadow:0 4px 16px rgba(0,0,0,0.12);border-radius:8px;',
      axisPointer: pointer === 'line' ? { type: 'line', lineStyle: { color: t.axis } } : { type: 'shadow', shadowStyle: { color: t.wash } },
      formatter: (params: { dataIndex: number } | { dataIndex: number }[]) => {
        const first = Array.isArray(params) ? params[0] : params
        return first ? tooltip(first.dataIndex) : ''
      },
    },
  }
}

/** Round up to a clean axis value, e.g. 3,150 → 4,000 and 11,100 → 12,000 */
function niceCeil(x: number): number {
  if (x <= 0) return 0
  const power = 10 ** Math.floor(Math.log10(x))
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * power >= x)!
  return step * power
}

/** y-axis max that always leaves room for the goal line, which ECharts doesn't count when scaling. */
export function maxWithGoal(goal: number | null) {
  return (extent: { max: number }) => niceCeil(Math.max(extent.max, goal ?? 0) * 1.05)
}

/**
 * Dashed reference line (a goal or an average). Dashed on purpose: it's a threshold, not a gridline.
 * No inline label (it collides with recent data on the right); the legend names it.
 */
export function goalLine(t: Tokens, value: number | null) {
  if (value == null) return undefined
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color: t['ink-2'], type: 'dashed', width: 1 },
    label: { show: false },
    emphasis: { disabled: true },
    data: [{ yAxis: value, label: { show: false } }],
  }
}

/** A faint full-height band behind each day that has no data, so gaps read as "not logged", not as zero. */
export function notLoggedSeries(t: Tokens, missing: boolean[]) {
  const renderItem: CustomSeriesRenderItem = (params, api) => {
    const index = api.value(0) as number
    const x = api.coord([index, 0])[0]
    const width = (api.size!([1, 0]) as number[])[0]
    const grid = params.coordSys as unknown as { x: number; y: number; width: number; height: number }
    return {
      type: 'rect',
      shape: { x: x - width / 2 + 1, y: grid.y, width: width - 2, height: grid.height, r: 4 },
      style: { fill: t.wash },
    }
  }
  return {
    type: 'custom',
    name: 'Not logged',
    silent: true,
    z: -1,
    tooltip: { show: false },
    renderItem,
    data: missing.flatMap((m, i) => (m ? [[i]] : [])),
    encode: { x: 0 },
  }
}

/** Bar spec: thin, 4px rounded data end, square at the baseline. */
export const BAR = { barMaxWidth: 24 }
export const roundTop = [4, 4, 0, 0]

/** Line spec: 2px, markers >= 8px with a 2px surface ring. */
export function lineStyle(t: Tokens, color: string) {
  return {
    type: 'line',
    connectNulls: false,
    showSymbol: true,
    symbol: 'circle',
    symbolSize: 8,
    lineStyle: { width: 2, color, cap: 'round', join: 'round' },
    itemStyle: { color, borderColor: t.surface, borderWidth: 2 },
    emphasis: { scale: 1.4 },
  }
}
