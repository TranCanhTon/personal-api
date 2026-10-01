// Shared building blocks so every chart has the same axes, tooltip, goal line and "not logged" look.
import type { CustomSeriesRenderItem } from 'echarts'
import { graphic } from 'echarts/core'
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
    // Bars and points grow in one after another, left to right
    animationDuration: 900,
    animationEasing: 'cubicOut',
    animationDelay: (i: number) => i * 35,
    animationDurationUpdate: 500,
    textStyle: { fontFamily: 'Inter Variable, system-ui, sans-serif' },
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
      extraCssText: 'box-shadow:0 10px 30px rgba(0,0,0,0.5);border-radius:12px;',
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

/** '#ff4d6d' + 0.4 → '#ff4d6d66' */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0')
}

/** Vertical gradient for bars and areas: strong at the top, fading toward the baseline. */
export function fade(color: string, top = 1, bottom = 0.3) {
  return new graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: withAlpha(color, top) },
    { offset: 1, color: withAlpha(color, bottom) },
  ])
}

/** Neon glow around a mark. */
export function glow(color: string, blur = 14) {
  return { shadowBlur: blur, shadowColor: withAlpha(color, 0.7) }
}

/** Line spec: 2px glowing line, markers >= 8px with a 2px surface ring; optional gradient area underneath. */
export function lineStyle(t: Tokens, color: string, { area = false }: { area?: boolean } = {}) {
  return {
    type: 'line',
    connectNulls: false,
    showSymbol: true,
    symbol: 'circle',
    symbolSize: 8,
    smooth: 0.25,
    lineStyle: { width: 2.5, color, cap: 'round', join: 'round', ...glow(color, 12) },
    itemStyle: { color, borderColor: t.surface, borderWidth: 2 },
    areaStyle: area ? { color: fade(color, 0.28, 0) } : undefined,
    emphasis: { scale: 1.5 },
  }
}
