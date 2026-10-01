import { useMemo, useState } from 'react'
import type { Sleep } from '../../api/client'
import { ChartCard } from '../../components/ChartCard'
import { EChart } from '../../components/EChart'
import { Readout } from '../../components/Readout'
import { NOT_LOGGED, time24, withUnit } from '../../lib/format'
import { useTheme } from '../../lib/theme'

const HALF_HOUR = 30 * 60_000

/** One night's heart rate: one lowest→highest bar per half hour, with a readout of the night or the hovered half hour. */
export function SleepHeartRateNight({ sleep }: { sleep: Sleep | null }) {
  const { tokens: t } = useTheme()
  const [hoveredAt, setHoveredAt] = useState<number | null>(null)

  const night = useMemo(() => {
    const intervals = sleep?.heart_rate?.intervals ?? []
    return {
      intervals,
      // Bars sit in the middle of their half hour
      mid: intervals.map((i) => new Date(i.start).getTime() + HALF_HOUR / 2),
      lows: intervals.map((i) => i.min ?? i.max ?? null),
      highs: intervals.map((i) => i.max ?? i.min ?? null),
    }
  }, [sleep])

  const option = useMemo(() => {
    const { intervals, mid, lows, highs } = night
    if (intervals.length === 0) return null
    const start = new Date(intervals[0].start).getTime()
    const end = Math.max(sleep?.wake_time ? new Date(sleep.wake_time).getTime() : 0, mid[mid.length - 1] + HALF_HOUR / 2)
    const peak = highs.reduce<number>((best, v, i) => (v != null && (highs[best] == null || v > highs[best]!) ? i : best), 0)
    const low = lows.reduce<number>((best, v, i) => (v != null && (lows[best] == null || v < lows[best]!) ? i : best), 0)

    const extreme = (label: string, value: number | null) => ({
      formatter: `{k|${label}}\n{v|${value == null ? '' : Math.round(value)}}`,
      rich: {
        k: { color: t['ink-2'], fontSize: 10, fontWeight: 600, lineHeight: 14 },
        v: { color: t.ink, fontSize: 16, fontWeight: 600, lineHeight: 20 },
      },
    })

    return {
      animationDuration: 300,
      // Room above and below for the MAX and MIN labels
      grid: { left: 4, right: 12, top: 48, bottom: 44, containLabel: true },
      xAxis: {
        type: 'time',
        min: start,
        max: end,
        axisLine: { lineStyle: { color: t.axis } },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: (v: { min: number }) => Math.floor((v.min - 1) / 10) * 10,
        max: (v: { max: number }) => Math.ceil((v.max + 1) / 10) * 10,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: t.grid, width: 1 } },
        axisLabel: { color: t.muted },
      },
      // Hover highlight only; the readout under the chart shows the values
      tooltip: { trigger: 'axis', showContent: false, axisPointer: { type: 'line', lineStyle: { color: t.axis } } },
      series: [
        // Lowest→highest as a floating capsule: an invisible base up to the lowest value, then the range
        {
          type: 'bar',
          name: 'Base',
          stack: 'range',
          barWidth: 8,
          silent: true,
          itemStyle: { color: 'transparent' },
          data: mid.map((x, i) => [x, lows[i]]),
        },
        {
          type: 'bar',
          name: 'Range',
          stack: 'range',
          barWidth: 8,
          barMinHeight: 8, // a half hour with a single reading still shows as a dot
          itemStyle: { color: t['series-1'], borderRadius: 4 },
          data: mid.map((x, i) => [x, lows[i] != null && highs[i] != null ? highs[i]! - lows[i]! : null]),
        },
        // The night's peak and lowest: a ringed dot on the exact value, with its number
        {
          type: 'scatter',
          name: 'Extremes',
          silent: true,
          symbolSize: 8,
          itemStyle: { color: t['series-1'], borderColor: t.surface, borderWidth: 2 },
          z: 3,
          data: [
            { value: [mid[peak], highs[peak]], label: { show: true, position: 'top', distance: 6, ...extreme('MAX', highs[peak]) } },
            { value: [mid[low], lows[low]], label: { show: true, position: 'bottom', distance: 6, ...extreme('MIN', lows[low]) } },
          ],
        },
      ],
    }
  }, [night, sleep, t])

  // The pointer reports a time; pick the half hour whose bar is closest
  const hovered =
    hoveredAt == null || night.mid.length === 0
      ? null
      : night.mid.reduce((best, x, i) => (Math.abs(x - hoveredAt) < Math.abs(night.mid[best] - hoveredAt) ? i : best), 0)

  const bpm = (v: number | null | undefined) => (v == null ? null : withUnit(v, 'bpm'))
  const readout =
    hovered == null
      ? {
          title: 'Night',
          items: [
            { label: 'Lowest', value: bpm(sleep?.heart_rate?.min) },
            { label: 'Peak', value: bpm(sleep?.heart_rate?.max) },
          ],
        }
      : {
          title: `${time24(night.intervals[hovered].start)}–${time24(new Date(night.mid[hovered] + HALF_HOUR / 2).toISOString())}`,
          items: [
            { label: 'Lowest', value: bpm(night.lows[hovered]) },
            { label: 'Peak', value: bpm(night.highs[hovered]) },
          ],
        }

  return (
    <ChartCard
      title="Heart rate during sleep"
      table={{
        head: ['Time', 'Lowest', 'Highest'],
        rows: night.intervals.map((i) => [time24(i.start), withUnit(i.min, 'bpm'), withUnit(i.max, 'bpm')]),
      }}
      footer={option ? <Readout {...readout} /> : undefined}
    >
      {option ? (
        <>
          <EChart option={option} label="Heart rate during sleep, lowest and highest per half hour" onHover={setHoveredAt} />
          <div className="flex justify-between px-1 text-xs text-muted tabular-nums">
            <span>{time24(night.intervals[0].start)}</span>
            <span>{time24(sleep?.wake_time)}</span>
          </div>
        </>
      ) : (
        <p className="py-10 text-center text-sm text-muted">{NOT_LOGGED}</p>
      )}
    </ChartCard>
  )
}
