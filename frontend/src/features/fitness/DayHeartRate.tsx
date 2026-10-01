import { useMemo, useState, type CSSProperties } from 'react'
import type { Day } from '../../api/client'
import { AnimatedValue } from '../../components/AnimatedValue'
import { ChartCard } from '../../components/ChartCard'
import { EChart } from '../../components/EChart'
import { Readout } from '../../components/Readout'
import { fade, glow } from '../../lib/chartKit'
import { NOT_LOGGED, time24, withUnit } from '../../lib/format'
import { useTheme } from '../../lib/theme'

const HOUR = 60 * 60_000

/** One day's heart rate: a lowest→highest bar per hour across 00–24, with the day's average on top and the hovered hour under it. */
export function DayHeartRate({ day }: { day: Day }) {
  const { tokens: t } = useTheme()
  const hr = day.fitness.heart_rate
  const [hoveredAt, setHoveredAt] = useState<number | null>(null)

  const hours = useMemo(() => {
    const intervals = hr?.intervals ?? []
    const dayStart = new Date(`${day.date}T00:00:00`).getTime()
    return {
      intervals,
      // x is hours since local midnight (0–24); bars sit in the middle of their hour
      mid: intervals.map((i) => (new Date(i.start).getTime() - dayStart) / HOUR + 0.5),
      lows: intervals.map((i) => i.min ?? i.max ?? null),
      highs: intervals.map((i) => i.max ?? i.min ?? null),
    }
  }, [hr, day.date])

  const option = useMemo(() => {
    const { intervals, mid, lows, highs } = hours
    if (intervals.length === 0) return null
    const top = Math.max(200, ...highs.filter((v): v is number => v != null))

    return {
      animationDuration: 300,
      grid: { left: 4, right: 12, top: 16, bottom: 4, containLabel: true },
      xAxis: {
        type: 'value',
        min: 0,
        max: 24,
        interval: 6,
        axisLine: { lineStyle: { color: t.axis } },
        axisTick: { show: false },
        axisLabel: { color: t.muted, showMaxLabel: false, formatter: (v: number) => String(v).padStart(2, '0') },
        splitLine: { show: true, lineStyle: { color: t.grid, width: 1 } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: Math.ceil(top / 50) * 50,
        interval: 50,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: t.grid, width: 1 } },
        axisLabel: { color: t.muted },
      },
      // Hover highlight only; the readout under the chart shows the hour's values
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
          barMinHeight: 8, // an hour with a single reading still shows as a dot
          itemStyle: { color: fade(t.heart, 1, 0.55), borderRadius: 4, ...glow(t.heart, 10) },
          data: mid.map((x, i) => [x, lows[i] != null && highs[i] != null ? highs[i]! - lows[i]! : null]),
        },
      ],
    }
  }, [hours, t])

  // The pointer reports hours since midnight; pick the hour whose bar is closest
  const hovered =
    hoveredAt == null || hours.mid.length === 0
      ? null
      : hours.mid.reduce((best, x, i) => (Math.abs(x - hoveredAt) < Math.abs(hours.mid[best] - hoveredAt) ? i : best), 0)

  const bpm = (v: number | null | undefined) => (v == null ? null : withUnit(v, 'bpm'))
  const readout =
    hovered == null
      ? { title: 'Day', items: [{ label: 'Lowest', value: bpm(hr?.min) }, { label: 'Highest', value: bpm(hr?.max) }] }
      : {
          title: `${time24(hours.intervals[hovered].start)}–${time24(new Date(new Date(hours.intervals[hovered].start).getTime() + HOUR).toISOString())}`,
          items: [
            { label: 'Lowest', value: bpm(hours.lows[hovered]) },
            { label: 'Highest', value: bpm(hours.highs[hovered]) },
          ],
        }

  return (
    <ChartCard
      title="Heart rate"
      accent="var(--heart)"
      table={{
        head: ['Hour', 'Lowest', 'Highest'],
        rows: hours.intervals.map((i) => [time24(i.start), withUnit(i.min, 'bpm'), withUnit(i.max, 'bpm')]),
      }}
      footer={option ? <Readout {...readout} /> : undefined}
    >
      <div className="mb-1">
        <div className="text-[11px] tracking-[0.14em] text-ink-2 uppercase">Average</div>
        <div
          className={`mt-1 font-display text-2xl font-semibold ${hr?.avg == null ? 'text-muted' : 'neon-text'}`}
          style={{ '--accent': 'var(--heart)' } as CSSProperties}
        >
          {hr?.avg == null ? NOT_LOGGED : <AnimatedValue text={withUnit(hr.avg, 'bpm')} />}
        </div>
      </div>
      {option ? (
        <EChart option={option} label="Heart rate across the day, lowest and highest per hour" onHover={setHoveredAt} />
      ) : (
        <p className="py-10 text-center text-sm text-muted">{NOT_LOGGED}</p>
      )}
    </ChartCard>
  )
}
