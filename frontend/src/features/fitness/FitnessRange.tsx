import { useMemo, useState } from 'react'
import type { Day } from '../../api/client'
import { ChartCard } from '../../components/ChartCard'
import { EChart } from '../../components/EChart'
import { Readout } from '../../components/Readout'
import { StatTile } from '../../components/StatTile'
import { BAR, baseOption, fade, glow, goalLine, lineStyle, maxWithGoal, notLoggedSeries, roundTop, tooltipHtml } from '../../lib/chartKit'
import { shortDate, weekday } from '../../lib/dates'
import { mean, num, withUnit } from '../../lib/format'
import { useGoals } from '../../lib/goals'
import { useTheme } from '../../lib/theme'
import { Workouts } from '../Workouts'

const isNull = (v: unknown) => v == null

export function FitnessRange({ days }: { days: Day[] }) {
  const { tokens: t } = useTheme()
  const { goals } = useGoals()
  const [hoveredHr, setHoveredHr] = useState<number | null>(null)
  const [hoveredMacros, setHoveredMacros] = useState<number | null>(null)

  const d = useMemo(() => {
    const f = days.map((day) => day.fitness)
    const hr = f.map((x) => x.heart_rate)
    const macros = f.map((x) => x.macros)
    return {
      dates: days.map((day) => day.date),
      titles: days.map((day) => weekday(day.date)),
      calIn: f.map((x) => x.calories_in ?? null),
      steps: f.map((x) => x.steps ?? null),
      hrMin: hr.map((x) => x?.min ?? null),
      hrAvg: hr.map((x) => x?.avg ?? null),
      hrMax: hr.map((x) => x?.max ?? null),
      hrResting: hr.map((x) => x?.resting ?? null),
      hrMissing: hr.map((x) => x == null || (x.min == null && x.avg == null && x.max == null && x.resting == null)),
      protein: macros.map((x) => x.protein_g ?? null),
      carbs: macros.map((x) => x.carbs_g ?? null),
      fat: macros.map((x) => x.fat_g ?? null),
      macrosMissing: macros.map((x) => x.protein_g == null && x.carbs_g == null && x.fat_g == null),
    }
  }, [days])

  // ---------- calories in ----------
  const caloriesOption = useMemo(
    () => ({
      ...baseOption({
        t,
        dates: d.dates,
        yAxis: { max: maxWithGoal(goals.caloriesIn), axisLabel: { color: t.muted, formatter: (v: number) => num(v) } },
        tooltip: (i) => tooltipHtml(t, d.titles[i], [{ color: t.calories, label: 'Calories in', value: withUnit(d.calIn[i], 'kcal') }]),
      }),
      series: [
        notLoggedSeries(t, d.calIn.map(isNull)),
        { ...lineStyle(t, t.calories, { area: true }), name: 'Calories in', data: d.calIn, markLine: goalLine(t, goals.caloriesIn) },
      ],
    }),
    [d, t, goals.caloriesIn],
  )

  // ---------- steps ----------
  const stepsOption = useMemo(
    () => ({
      ...baseOption({
        t,
        dates: d.dates,
        pointer: 'shadow',
        yAxis: { max: maxWithGoal(goals.steps), axisLabel: { color: t.muted, formatter: (v: number) => num(v) } },
        tooltip: (i) => {
          const hit = goals.steps != null && d.steps[i] != null && d.steps[i]! >= goals.steps
          return tooltipHtml(t, d.titles[i], [{ color: hit ? t['steps-goal'] : t.steps, label: 'Steps', value: num(d.steps[i]) }])
        },
      }),
      series: [
        notLoggedSeries(t, d.steps.map(isNull)),
        {
          type: 'bar',
          ...BAR,
          name: 'Steps',
          // Days that reached the goal are bright green and glow
          data: d.steps.map((v) => {
            if (v == null) return null
            const hit = goals.steps != null && v >= goals.steps
            const color = hit ? t['steps-goal'] : t.steps
            return { value: v, itemStyle: { color: fade(color, 1, hit ? 0.45 : 0.35), ...(hit ? glow(color, 16) : {}) } }
          }),
          itemStyle: { borderRadius: roundTop },
          markLine: goalLine(t, goals.steps),
        },
      ],
    }),
    [d, t, goals.steps],
  )

  // ---------- heart rate ----------
  const hrOption = useMemo(
    () => ({
      ...baseOption({
        t,
        dates: d.dates,
        pointer: 'shadow',
        yAxis: { scale: true, axisLabel: { color: t.muted } },
        // The hovered day shows in the readout under the chart instead of a popup
        hideTooltip: true,
        tooltip: () => '',
      }),
      series: [
        notLoggedSeries(t, d.hrMissing),
        // Min–max as a floating bar: an invisible base up to min, then the range on top
        {
          type: 'bar',
          stack: 'range',
          barMaxWidth: 12,
          silent: true,
          itemStyle: { color: 'transparent' },
          data: d.hrMin.map((v, i) => (v != null && d.hrMax[i] != null ? v : null)),
        },
        {
          type: 'bar',
          stack: 'range',
          barMaxWidth: 12,
          name: 'Min–max',
          itemStyle: { color: fade(t.heart, 0.45, 0.15), borderRadius: 6 },
          data: d.hrMin.map((v, i) => (v != null && d.hrMax[i] != null ? d.hrMax[i]! - v : null)),
        },
        { ...lineStyle(t, t.heart), name: 'Average', data: d.hrAvg },
        { ...lineStyle(t, t['heart-2']), name: 'Resting', data: d.hrResting },
      ],
    }),
    [d, t],
  )

  // ---------- macros ----------
  const macrosOption = useMemo(() => {
    const layers = [
      { name: 'Protein', values: d.protein, color: t.protein },
      { name: 'Carbs', values: d.carbs, color: t.carbs },
      { name: 'Fat', values: d.fat, color: t.fat },
    ]
    // Only the top segment of each day's stack gets the rounded end
    const topLayer = d.dates.map((_, i) => {
      for (let l = layers.length - 1; l >= 0; l--) if (layers[l].values[i]) return l
      return -1
    })
    return {
      ...baseOption({
        t,
        dates: d.dates,
        pointer: 'shadow',
        yAxis: { axisLabel: { color: t.muted, formatter: (v: number) => `${v} g` } },
        // The hovered day shows in the readout under the chart instead of a popup
        hideTooltip: true,
        tooltip: () => '',
      }),
      series: [
        notLoggedSeries(t, d.macrosMissing),
        ...layers.map((l, li) => ({
          type: 'bar',
          ...BAR,
          stack: 'macros',
          name: l.name,
          data: l.values.map((v, i) =>
            v == null ? null : { value: v, itemStyle: { borderRadius: topLayer[i] === li ? roundTop : 0 } },
          ),
          itemStyle: { color: l.color, borderColor: t.surface, borderWidth: 1 },
        })),
      ],
    }
  }, [d, t])

  // ---------- summaries ----------
  const avgIn = mean(d.calIn)
  const avgSteps = mean(d.steps)

  // Readouts under the charts: the hovered day, or the period average
  const pick = (values: (number | null)[], i: number | null) => (i == null ? mean(values) : values[i])
  const fmt = (v: number | null | undefined, unit: string) => (v == null ? null : withUnit(v, unit))
  const titleFor = (i: number | null) => (i == null ? 'Average' : d.titles[i])

  const hrReadout = {
    title: titleFor(hoveredHr),
    items: [
      { label: 'Resting', swatch: { color: t['heart-2'], kind: 'line' as const }, value: fmt(pick(d.hrResting, hoveredHr), 'bpm') },
      { label: 'Average', swatch: { color: t.heart, kind: 'line' as const }, value: fmt(pick(d.hrAvg, hoveredHr), 'bpm') },
      { label: 'Lowest', swatch: { color: t.heart, kind: 'band' as const }, value: fmt(pick(d.hrMin, hoveredHr), 'bpm') },
      { label: 'Highest', swatch: { color: t.heart, kind: 'band' as const }, value: fmt(pick(d.hrMax, hoveredHr), 'bpm') },
    ],
  }

  const macrosReadout = {
    title: titleFor(hoveredMacros),
    items: [
      { label: 'Protein', swatch: { color: t.protein, kind: 'bar' as const }, value: fmt(pick(d.protein, hoveredMacros), 'g') },
      { label: 'Carbs', swatch: { color: t.carbs, kind: 'bar' as const }, value: fmt(pick(d.carbs, hoveredMacros), 'g') },
      { label: 'Fat', swatch: { color: t.fat, kind: 'bar' as const }, value: fmt(pick(d.fat, hoveredMacros), 'g') },
    ],
  }

  const row = (i: number, cells: string[]) => [shortDate(d.dates[i]), ...cells]
  const idx = d.dates.map((_, i) => i).reverse()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Avg calories in" value={withUnit(avgIn, 'kcal')} accent="var(--calories)" muted={avgIn == null} />
        <StatTile label="Avg steps" value={num(avgSteps)} accent="var(--steps-goal)" muted={avgSteps == null} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Calories in"
          accent="var(--calories)"
          summary={`Avg ${withUnit(avgIn, 'kcal')}`}
          legend={goals.caloriesIn ? [{ label: `Intake goal ${num(goals.caloriesIn)} kcal`, color: t['ink-2'], kind: 'goal' }] : []}
          table={{ head: ['Date', 'Calories in'], rows: idx.map((i) => row(i, [withUnit(d.calIn[i], 'kcal')])) }}
        >
          <EChart option={caloriesOption} label="Calories in per day" />
        </ChartCard>

        <ChartCard
          title="Steps"
          accent="var(--steps-goal)"
          summary={`Avg ${num(avgSteps)}`}
          legend={[
            { label: 'Steps', color: t.steps, kind: 'bar' },
            ...(goals.steps
              ? [
                  { label: 'Goal reached', color: t['steps-goal'], kind: 'bar' as const },
                  { label: 'Goal', color: t['ink-2'], kind: 'goal' as const },
                ]
              : []),
          ]}
          table={{ head: ['Date', 'Steps'], rows: idx.map((i) => row(i, [num(d.steps[i])])) }}
        >
          <EChart option={stepsOption} label="Steps per day, goal days in dark blue" />
        </ChartCard>

        <ChartCard
          title="Heart rate"
          accent="var(--heart)"
          footer={<Readout {...hrReadout} />}
          table={{
            head: ['Date', 'Resting', 'Min', 'Avg', 'Max'],
            rows: idx.map((i) => row(i, [withUnit(d.hrResting[i], 'bpm'), withUnit(d.hrMin[i], 'bpm'), withUnit(d.hrAvg[i], 'bpm'), withUnit(d.hrMax[i], 'bpm')])),
          }}
        >
          <EChart option={hrOption} label="Heart rate range, average and resting per day" onHover={setHoveredHr} />
        </ChartCard>

        <ChartCard
          title="Macros"
          accent="var(--protein)"
          footer={<Readout {...macrosReadout} />}
          table={{
            head: ['Date', 'Protein', 'Carbs', 'Fat'],
            rows: idx.map((i) => row(i, [withUnit(d.protein[i], 'g'), withUnit(d.carbs[i], 'g'), withUnit(d.fat[i], 'g')])),
          }}
        >
          <EChart option={macrosOption} label="Protein, carbs and fat per day" onHover={setHoveredMacros} />
        </ChartCard>

        <Workouts days={days} showDate />
      </div>
    </div>
  )
}
