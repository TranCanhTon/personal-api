from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas
from app.models import DailyFitness, Workout


def _runs(sorted_units: list[int]) -> list[tuple[int, int]]:
    """(first, length) of each run of consecutive integers in an ascending list."""
    runs: list[tuple[int, int]] = []
    for u in sorted_units:
        if runs and runs[-1][0] + runs[-1][1] == u:
            runs[-1] = (runs[-1][0], runs[-1][1] + 1)
        else:
            runs.append((u, 1))
    return runs


def _current_and_best(units: set[int], now: int) -> tuple[int, int]:
    """Current streak and best streak over a set of integer units (day or week numbers).

    The current unit may still be in progress, so a streak that ends on the previous unit is still alive.
    """
    if not units:
        return 0, 0
    runs = _runs(sorted(units))
    best = max(length for _, length in runs)
    last_start, last_length = runs[-1]
    last = last_start + last_length - 1
    current = last_length if last >= now - 1 else 0
    return current, best


def food_streak(db: Session, today: date) -> schemas.FoodStreak:
    """Consecutive days with food logged (any calories saved for the day). Today may not be logged yet."""
    days = set(
        db.scalars(select(DailyFitness.date).where(DailyFitness.calories_in.is_not(None), DailyFitness.calories_in > 0))
    )
    current, best = _current_and_best({d.toordinal() for d in days}, today.toordinal())
    return schemas.FoodStreak(current=current, best=best, logged_today=today in days)


def _week_number(day: date) -> int:
    """Whole weeks since a Monday. Monday to Sunday share a number (date ordinal 1 is a Monday)."""
    return (day.toordinal() - 1) // 7


def gym_streak(db: Session, today: date, per_week: int | None) -> schemas.GymStreak:
    """Consecutive weeks (Monday to Sunday) with at least `per_week` workouts. This week may still be in progress."""
    weeks: dict[int, int] = {}
    for d, n in db.execute(select(Workout.date, func.count()).group_by(Workout.date)):
        weeks[_week_number(d)] = weeks.get(_week_number(d), 0) + n

    this_week = weeks.get(_week_number(today), 0)
    if not per_week:
        return schemas.GymStreak(current=0, best=0, this_week=this_week, target=None)

    hit = {w for w, n in weeks.items() if n >= per_week}
    current, best = _current_and_best(hit, _week_number(today))
    return schemas.GymStreak(current=current, best=best, this_week=this_week, target=per_week)
