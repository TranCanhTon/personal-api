"""Turns a Health Auto Export JSON payload into rows in our tables.

Expected shape (Health Auto Export, JSON, REST API automation):
    {"data": {"metrics": [...], "workouts": [...]}}

Set the automation's aggregation to "Minutes". Values are rolled up into daily
totals that overwrite the stored value for that day, so sending the same day
twice is safe. Heart rate is also kept per minute so it can be read for the
sleep window. With "Day" aggregation everything still works except sleep
heart rate, because one value per day can't be split into night and day.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from statistics import mean
from typing import Any

from sqlalchemy.orm import Session

from app.models import DailyFitness, HeartRateDaily, HeartRateSample, Sleep, Workout
from app.services.db_utils import upsert

KJ_PER_KCAL = 4.184

# Health Auto Export metric name -> daily_fitness column. Values are summed per day.
DAILY_SUM_METRICS = {
    "step_count": "steps",
    "active_energy": "active_calories",
    "basal_energy_burned": "basal_calories",
    "dietary_energy": "calories_in",
    "protein": "protein_g",
    "carbohydrates": "carbs_g",
    "total_fat": "fat_g",
}
ENERGY_COLUMNS = {"active_calories", "basal_calories", "calories_in"}


@dataclass
class ImportResult:
    days_fitness: int = 0
    days_heart_rate: int = 0
    heart_rate_samples: int = 0
    nights_sleep: int = 0
    workouts: int = 0
    ignored_metrics: list[str] = field(default_factory=list)
    skipped_sleep_entries: int = 0

    @property
    def records(self) -> int:
        return self.days_fitness + self.days_heart_rate + self.nights_sleep + self.workouts


def parse_ts(value: str) -> datetime:
    """Parses '2024-02-06 14:30:00 -0800' (Health Auto Export) or ISO 8601."""
    try:
        return datetime.strptime(value, "%Y-%m-%d %H:%M:%S %z")
    except ValueError:
        return datetime.fromisoformat(value)


def day_of(value: str) -> date:
    # The date part is already in the phone's local time, which is the day we want
    return date.fromisoformat(value[:10])


def to_kcal(qty: float, units: str | None) -> float:
    return qty / KJ_PER_KCAL if (units or "").lower() == "kj" else qty


def quantity(value: Any) -> float | None:
    """Workout fields come as either a number or {"qty": n, "units": "..."}."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, dict) and value.get("qty") is not None:
        return to_kcal(float(value["qty"]), value.get("units"))
    return None


def _hours_to_min(value: Any, factor: float) -> float | None:
    return round(float(value) * factor, 1) if value is not None else None


def import_health_payload(db: Session, payload: dict) -> ImportResult:
    result = ImportResult()
    data = payload.get("data", payload)

    fitness: dict[date, dict[str, float]] = defaultdict(dict)
    hr_min: dict[date, list[float]] = defaultdict(list)
    hr_avg: dict[date, list[float]] = defaultdict(list)
    hr_max: dict[date, list[float]] = defaultdict(list)
    hr_resting: dict[date, list[float]] = defaultdict(list)
    hr_samples: dict[datetime, dict[str, float]] = {}

    for metric in data.get("metrics", []):
        name = metric.get("name")
        units = metric.get("units")
        entries = metric.get("data", [])

        if name in DAILY_SUM_METRICS:
            column = DAILY_SUM_METRICS[name]
            for entry in entries:
                if entry.get("qty") is None:
                    continue
                qty = float(entry["qty"])
                if column in ENERGY_COLUMNS:
                    qty = to_kcal(qty, units)
                day = day_of(entry["date"])
                fitness[day][column] = fitness[day].get(column, 0) + qty

        elif name == "heart_rate":
            for entry in entries:
                day = day_of(entry["date"])
                for key, bucket in (("Min", hr_min), ("Avg", hr_avg), ("Max", hr_max)):
                    if entry.get(key) is not None:
                        bucket[day].append(float(entry[key]))
                sample = {k.lower(): float(entry[k]) for k in ("Min", "Avg", "Max") if entry.get(k) is not None}
                if sample:
                    hr_samples[parse_ts(entry["date"])] = sample

        elif name == "resting_heart_rate":
            for entry in entries:
                if entry.get("qty") is not None:
                    hr_resting[day_of(entry["date"])].append(float(entry["qty"]))

        elif name == "sleep_analysis":
            factor = 1 if (units or "").lower().startswith("min") else 60
            for entry in entries:
                total = entry.get("totalSleep", entry.get("asleep"))
                if total is None or "date" not in entry:
                    # Unaggregated stage by stage entries. Turn on "Aggregate sleep" in the app.
                    result.skipped_sleep_entries += 1
                    continue
                upsert(db, Sleep, {
                    "date": day_of(entry["date"]),
                    "bedtime": parse_ts(entry["sleepStart"]) if entry.get("sleepStart") else None,
                    "wake_time": parse_ts(entry["sleepEnd"]) if entry.get("sleepEnd") else None,
                    "total_min": _hours_to_min(total, factor),
                    "deep_min": _hours_to_min(entry.get("deep"), factor),
                    "rem_min": _hours_to_min(entry.get("rem"), factor),
                    "core_min": _hours_to_min(entry.get("core"), factor),
                    "awake_min": _hours_to_min(entry.get("awake"), factor),
                }, key=["date"])
                result.nights_sleep += 1

        elif name:
            result.ignored_metrics.append(name)

    for day, values in fitness.items():
        row = {"date": day, **{k: round(v, 1) for k, v in values.items()}}
        if "steps" in row:
            row["steps"] = int(row["steps"])
        upsert(db, DailyFitness, row, key=["date"])
    result.days_fitness = len(fitness)

    hr_days = set(hr_min) | set(hr_avg) | set(hr_max) | set(hr_resting)
    for day in hr_days:
        row: dict[str, Any] = {"date": day}
        if hr_min[day]:
            row["min"] = min(hr_min[day])
        if hr_avg[day]:
            row["avg"] = round(mean(hr_avg[day]), 1)
        if hr_max[day]:
            row["max"] = max(hr_max[day])
        if hr_resting[day]:
            row["resting"] = round(mean(hr_resting[day]), 1)
        upsert(db, HeartRateDaily, row, key=["date"])
    result.days_heart_rate = len(hr_days)

    # One entry per day means "Day" aggregation. Those can't be placed inside a
    # sleep window (a whole day's max would land at midnight), so skip them.
    if len(hr_samples) > len({ts.date() for ts in hr_samples}):
        for ts, sample in hr_samples.items():
            upsert(db, HeartRateSample, {"ts": ts, **sample}, key=["ts"])
        result.heart_rate_samples = len(hr_samples)

    for w in data.get("workouts", []):
        start = parse_ts(w["start"])
        end = parse_ts(w["end"])
        duration_s = w.get("duration")
        duration_min = float(duration_s) / 60 if duration_s is not None else (end - start).total_seconds() / 60
        upsert(db, Workout, {
            # Version 1 exports have no id, so build a stable one from name and start
            "source_id": w.get("id") or f"{w.get('name', 'workout')}|{w['start']}",
            "date": day_of(w["start"]),
            "type": w.get("name", "Workout"),
            "start_time": start,
            "end_time": end,
            "duration_min": round(duration_min, 1),
            "calories": quantity(w.get("activeEnergyBurned", w.get("activeEnergy"))),
            "avg_heart_rate": quantity(w.get("avgHeartRate")),
            "max_heart_rate": quantity(w.get("maxHeartRate")),
        }, key=["source_id"])
        result.workouts += 1

    return result
