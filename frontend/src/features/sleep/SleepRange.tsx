import { useMemo, useState } from "react";
import type { Day } from "../../api/client";
import { ChartCard } from "../../components/ChartCard";
import { EChart } from "../../components/EChart";
import { Headline } from "../../components/Headline";
import { Readout } from "../../components/Readout";
import { StatTile } from "../../components/StatTile";
import {
  baseOption,
  BAR,
  goalLine,
  maxWithGoal,
  notLoggedSeries,
  roundTop,
} from "../../lib/chartKit";
import { shortDate, weekday } from "../../lib/dates";
import { duration, mean, NOT_LOGGED, time24, withUnit } from "../../lib/format";
import { useGoals } from "../../lib/goals";
import { useTheme } from "../../lib/theme";
import { inBedMinutes, nightClock, nightHours, stages } from "./sleepUtils";

export function SleepRange({ days }: { days: Day[] }) {
  const { tokens: t } = useTheme();
  const { goals } = useGoals();
  const [hovered, setHovered] = useState<number | null>(null);
  const [hoveredSchedule, setHoveredSchedule] = useState<number | null>(null);
  const [hoveredHr, setHoveredHr] = useState<number | null>(null);

  const d = useMemo(() => {
    const hrMin = days.map((day) => day.sleep?.heart_rate?.min ?? null);
    const hrMax = days.map((day) => day.sleep?.heart_rate?.max ?? null);
    return {
      dates: days.map((day) => day.date),
      titles: days.map((day) => weekday(day.date)),
      sleep: days.map((day) => day.sleep ?? null),
      missing: days.map((day) => day.sleep == null),
      total: days.map((day) => day.sleep?.total_min ?? null),
      bed: days.map((day) => nightHours(day.sleep?.bedtime)),
      wake: days.map((day) => nightHours(day.sleep?.wake_time)),
      hrMin,
      hrMax,
      hrMissing: hrMin.map((v, i) => v == null || hrMax[i] == null),
    };
  }, [days]);

  const avgTotal = mean(d.total);
  const avgBed = mean(d.bed);
  const avgWake = mean(d.wake);

  // ---------- stages ----------
  const stagesOption = useMemo(() => {
    const layers = stages(t);
    const topLayer = d.dates.map((_, i) => {
      for (let l = layers.length - 1; l >= 0; l--)
        if (d.sleep[i]?.[layers[l].key]) return l;
      return -1;
    });
    return {
      ...baseOption({
        t,
        dates: d.dates,
        pointer: "shadow",
        yAxis: {
          max: maxWithGoal(goals.sleepHours),
          axisLabel: { color: t.muted, formatter: (v: number) => `${v} h` },
        },
        // The hovered night shows in the readout under the chart instead of a popup
        hideTooltip: true,
        tooltip: () => "",
      }),
      series: [
        notLoggedSeries(t, d.missing),
        ...layers.map((l, li) => ({
          type: "bar",
          ...BAR,
          stack: "stages",
          name: l.label,
          data: d.sleep.map((s, i) => {
            const v = s?.[l.key];
            return v == null
              ? null
              : {
                  value: v / 60,
                  itemStyle: {
                    borderRadius: topLayer[i] === li ? roundTop : 0,
                  },
                };
          }),
          itemStyle: { color: l.color, borderColor: t.surface, borderWidth: 1 },
          markLine:
            li === 0 && goals.sleepHours != null
              ? goalLine(t, goals.sleepHours)
              : undefined,
        })),
      ],
    };
  }, [d, t, goals.sleepHours]);

  // ---------- schedule ----------
  const scheduleOption = useMemo(() => {
    const bedValues = d.bed.filter((v): v is number => v != null);
    const wakeValues = d.wake.filter((v): v is number => v != null);
    const lo = Math.max(
      bedValues.length ? Math.floor(Math.min(...bedValues)) - 1 : 4,
      0,
    );
    const rawHi = Math.min(
      wakeValues.length ? Math.ceil(Math.max(...wakeValues)) + 1 : 16,
      24,
    );
    // End on a whole 2-hour step from the top, so the last tick doesn't crowd the one above it
    const hi = lo + Math.ceil((rawHi - lo) / 2) * 2;
    const both = d.bed.map((b, i) => b != null && d.wake[i] != null);
    return {
      ...baseOption({
        t,
        dates: d.dates,
        pointer: "shadow",
        // Earlier times at the top, so each bar reads top-down from bedtime to waking
        yAxis: {
          inverse: true,
          min: lo,
          max: hi,
          interval: 2,
          axisLabel: {
            color: t.muted,
            formatter: (v: number) => nightClock(v, true),
          },
        },
        // The hovered night shows in the readout under the chart instead of a popup
        hideTooltip: true,
        tooltip: () => "",
      }),
      series: [
        notLoggedSeries(
          t,
          d.bed.map((_, i) => !both[i]),
        ),
        {
          type: "bar",
          ...BAR,
          stack: "night",
          silent: true,
          itemStyle: { color: "transparent" },
          data: d.bed.map((b, i) => (both[i] ? b : null)),
        },
        {
          type: "bar",
          ...BAR,
          stack: "night",
          name: "In bed",
          itemStyle: { color: t["series-1"], borderRadius: 4 },
          data: d.bed.map((b, i) => (both[i] ? d.wake[i]! - b! : null)),
          markLine: goalLine(t, avgBed),
        },
      ],
    };
  }, [d, t, avgBed]);

  // ---------- heart rate during sleep ----------
  const sleepHrOption = useMemo(
    () => ({
      ...baseOption({
        t,
        dates: d.dates,
        pointer: "shadow",
        // Pad to the next 10 bpm (the tick step) so the peak and the lowest never sit on the chart edge
        yAxis: {
          min: (v: { min: number }) => Math.floor((v.min - 1) / 10) * 10,
          max: (v: { max: number }) => Math.ceil((v.max + 1) / 10) * 10,
          axisLabel: { color: t.muted },
        },
        // The hovered night shows in the readout under the chart instead of a popup
        hideTooltip: true,
        tooltip: () => "",
      }),
      series: [
        notLoggedSeries(t, d.hrMissing),
        // Lowest→peak as a floating bar: an invisible base up to the lowest value, then the range on top
        {
          type: "bar",
          stack: "range",
          barMaxWidth: 12,
          silent: true,
          itemStyle: { color: "transparent" },
          data: d.hrMin.map((v, i) => (d.hrMissing[i] ? null : v)),
        },
        {
          type: "bar",
          stack: "range",
          barMaxWidth: 12,
          name: "Lowest to peak",
          itemStyle: { color: t["series-1"], borderRadius: 4 },
          data: d.hrMin.map((v, i) =>
            d.hrMissing[i] ? null : d.hrMax[i]! - v!,
          ),
        },
      ],
    }),
    [d, t],
  );

  const idx = d.dates.map((_, i) => i).reverse();
  const stageLayers = stages(t);

  // Readouts under the charts: the hovered night, or the period average
  const titleFor = (i: number | null) => (i == null ? "Average" : d.titles[i]);
  const minutes = (v: number | null | undefined) => (v == null ? null : duration(v));
  const bpm = (v: number | null | undefined) => (v == null ? null : withUnit(v, "bpm"));
  const clock = (v: number | null) => (v == null ? null : nightClock(v));

  const night = hovered == null ? null : d.sleep[hovered];
  const stagesReadout = {
    title: titleFor(hovered),
    asleep: hovered == null ? avgTotal : d.total[hovered],
    items: [...stageLayers].reverse().map((l) => ({
      label: l.label,
      swatch: { color: l.color, kind: "bar" as const },
      value: minutes(hovered == null ? mean(d.sleep.map((s) => s?.[l.key])) : night?.[l.key]),
    })),
  };

  const scheduleReadout = {
    title: titleFor(hoveredSchedule),
    items: [
      { label: "Bedtime", value: clock(hoveredSchedule == null ? avgBed : d.bed[hoveredSchedule]) },
      { label: "Wake time", value: clock(hoveredSchedule == null ? avgWake : d.wake[hoveredSchedule]) },
      {
        label: "Time in bed",
        value: minutes(
          hoveredSchedule == null ? mean(d.sleep.map(inBedMinutes)) : inBedMinutes(d.sleep[hoveredSchedule]),
        ),
      },
    ],
  };

  const hrReadout = {
    title: titleFor(hoveredHr),
    items: [
      { label: "Lowest", value: bpm(hoveredHr == null ? mean(d.hrMin) : d.hrMin[hoveredHr]) },
      { label: "Peak", value: bpm(hoveredHr == null ? mean(d.hrMax) : d.hrMax[hoveredHr]) },
    ],
  };

  return (
    <div className="space-y-4">
      <Headline
        label="Average time asleep"
        value={duration(avgTotal)}
        muted={avgTotal == null}
      />

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Avg bed time"
          value={avgBed == null ? NOT_LOGGED : nightClock(avgBed)}
          muted={avgBed == null}
        />
        <StatTile
          label="Avg wake time"
          value={avgWake == null ? NOT_LOGGED : nightClock(avgWake)}
          muted={avgWake == null}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Time asleep"
          legend={
            goals.sleepHours != null
              ? [{ label: "Goal", color: t["ink-2"], kind: "goal" }]
              : []
          }
          footer={
            <Readout
              title={stagesReadout.title}
              aside={{ label: "Asleep", value: duration(stagesReadout.asleep) }}
              items={stagesReadout.items}
            />
          }
          table={{
            head: ["Date", "Asleep", "Deep", "Core", "REM", "Awake"],
            rows: idx.map((i) => {
              const s = d.sleep[i];
              return [
                shortDate(d.dates[i]),
                duration(d.total[i]),
                duration(s?.deep_min),
                duration(s?.core_min),
                duration(s?.rem_min),
                duration(s?.awake_min),
              ];
            }),
          }}
        >
          <EChart
            option={stagesOption}
            label="Time asleep per night by sleep stage"
            onHover={setHovered}
          />
        </ChartCard>

        <ChartCard
          title="Sleep schedule"
          legend={[
            {
              label: "Bedtime to wake time",
              color: t["series-1"],
              kind: "bar",
            },
            { label: "Avg bedtime", color: t["ink-2"], kind: "goal" },
          ]}
          footer={<Readout {...scheduleReadout} />}
          table={{
            head: ["Date", "Bedtime", "Wake", "In bed"],
            rows: idx.map((i) => [
              shortDate(d.dates[i]),
              time24(d.sleep[i]?.bedtime),
              time24(d.sleep[i]?.wake_time),
              duration(inBedMinutes(d.sleep[i])),
            ]),
          }}
        >
          <EChart
            option={scheduleOption}
            label="Bedtime and wake time per night, with the average bedtime"
            onHover={setHoveredSchedule}
          />
        </ChartCard>

        <ChartCard
          title="Heart rate during sleep"
          footer={<Readout {...hrReadout} />}
          table={{
            head: ["Date", "Lowest", "Peak"],
            rows: idx.map((i) => [
              shortDate(d.dates[i]),
              withUnit(d.hrMin[i], "bpm"),
              withUnit(d.hrMax[i], "bpm"),
            ]),
          }}
        >
          <EChart
            option={sleepHrOption}
            label="Lowest and peak heart rate during sleep per night"
            onHover={setHoveredHr}
          />
        </ChartCard>
      </div>
    </div>
  );
}
