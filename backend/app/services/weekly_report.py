"""The Sunday report: how the week (Monday to Sunday) went, compared with the week before."""

from dataclasses import dataclass
from datetime import date, timedelta
from statistics import mean

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas
from app.models import DailyFitness, Sleep, Workout
from app.services import streaks
from app.services.goals import get_goals
from app.services.mailer import send_email


@dataclass
class WeekStats:
    start: date
    days_logged: int  # days with food logged
    avg_calories: float | None
    avg_protein: float | None
    avg_steps: float | None
    steps_goal_days: int | None  # None when there is no steps goal
    avg_sleep_h: float | None
    nights: int
    workouts: int
    workout_min: float
    best_steps_day: tuple[date, int] | None


def _avg(values: list[float]) -> float | None:
    return mean(values) if values else None


def week_stats(db: Session, start: date, goals: schemas.GoalsIn) -> WeekStats:
    end = start + timedelta(days=6)
    days = list(db.scalars(select(DailyFitness).where(DailyFitness.date.between(start, end))))
    sleeps = list(db.scalars(select(Sleep.total_min).where(Sleep.date.between(start, end), Sleep.total_min.is_not(None))))
    count, minutes = db.execute(
        select(func.count(), func.coalesce(func.sum(Workout.duration_min), 0)).where(Workout.date.between(start, end))
    ).one()

    logged = [d for d in days if d.calories_in]
    steps = [d for d in days if d.steps is not None]
    return WeekStats(
        start=start,
        days_logged=len(logged),
        avg_calories=_avg([d.calories_in for d in logged]),
        avg_protein=_avg([d.protein_g for d in logged if d.protein_g is not None]),
        avg_steps=_avg([d.steps for d in steps]),
        steps_goal_days=sum(d.steps >= goals.steps for d in steps) if goals.steps else None,
        avg_sleep_h=_avg([m / 60 for m in sleeps]),
        nights=len(sleeps),
        workouts=count,
        workout_min=minutes,
        best_steps_day=max(((d.date, d.steps) for d in steps), key=lambda x: x[1], default=None),
    )


def _fmt(value: float | None, unit: str = "", digits: int = 0) -> str:
    return "no data" if value is None else f"{value:,.{digits}f}{unit}"


def _delta(now: float | None, before: float | None, unit: str = "", digits: int = 0) -> str:
    if now is None or before is None:
        return ""
    diff = now - before
    if round(diff, digits) == 0:
        return "  (same as last week)"
    return f"  ({'+' if diff > 0 else '-'}{abs(diff):,.{digits}f}{unit} vs last week)"


def build_report(db: Session, today: date) -> tuple[str, str]:
    """(subject, plain text) for the Monday to Sunday week that `today` is in."""
    goals = get_goals(db)
    start = today - timedelta(days=today.weekday())
    this, last = week_stats(db, start, goals), week_stats(db, start - timedelta(days=7), goals)
    food, gym = streaks.food_streak(db, today), streaks.gym_streak(db, today, goals.workouts_per_week)

    lines = [
        f"Week of {start.isoformat()} to {(start + timedelta(days=6)).isoformat()}",
        "",
        "FITNESS",
        f"Workouts: {this.workouts}"
        + (f" of {goals.workouts_per_week}" if goals.workouts_per_week else "")
        + (f" ({this.workout_min:,.0f} min)" if this.workouts else "")
        + f"  (last week {last.workouts})",
        f"Steps per day: {_fmt(this.avg_steps)}{_delta(this.avg_steps, last.avg_steps)}",
    ]
    if this.steps_goal_days is not None:
        lines.append(f"Days at the steps goal ({goals.steps:,}): {this.steps_goal_days}")
    if this.best_steps_day:
        lines.append(f"Best steps day: {this.best_steps_day[0].strftime('%a %d %b')} with {this.best_steps_day[1]:,}")
    lines += [
        "",
        "FOOD",
        f"Days logged: {this.days_logged} of 7",
        f"Calories per logged day: {_fmt(this.avg_calories, ' kcal')}{_delta(this.avg_calories, last.avg_calories, ' kcal')}",
        f"Protein per logged day: {_fmt(this.avg_protein, ' g')}"
        + (f" (goal {goals.protein_g:.0f} g)" if goals.protein_g else "")
        + _delta(this.avg_protein, last.avg_protein, " g"),
        "",
        "SLEEP",
        f"Time asleep per night: {_fmt(this.avg_sleep_h, ' h', 1)}"
        + (f" (goal {goals.sleep_hours:g} h)" if goals.sleep_hours else "")
        + _delta(this.avg_sleep_h, last.avg_sleep_h, " h", 1)
        + f"  [{this.nights} nights]",
        "",
        "STREAKS",
        f"Food logging: {food.current} {'day' if food.current == 1 else 'days'} (best {food.best})",
    ]
    if gym.target:
        lines.append(
            f"Gym ({gym.target} a week): {gym.current} {'week' if gym.current == 1 else 'weeks'} in a row (best {gym.best}), "
            f"{gym.this_week} so far this week"
        )
    return f"Weekly report: {start.strftime('%d %b')}", "\n".join(lines) + "\n"


def run_weekly_report(db: Session, today: date, dry_run: bool = False) -> tuple[str, str, bool]:
    """(subject, body, sent). With dry_run nothing is sent."""
    subject, body = build_report(db, today)
    if not dry_run:
        send_email(subject, body)
    return subject, body, not dry_run
