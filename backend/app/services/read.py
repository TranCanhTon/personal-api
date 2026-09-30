"""Builds the JSON the website reads, one day at a time, from all tables."""

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app import schemas
from app.models import DailyFitness, HeartRateDaily, HeartRateSample, Sleep, Todo, Trade, Workout


def date_range(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def _between(column, start: date, end: date):
    return column.between(start, end)


def fitness_by_day(db: Session, start: date, end: date) -> dict[date, schemas.Fitness]:
    daily = {r.date: r for r in db.scalars(select(DailyFitness).where(_between(DailyFitness.date, start, end)))}
    hearts = {r.date: r for r in db.scalars(select(HeartRateDaily).where(_between(HeartRateDaily.date, start, end)))}
    workouts: dict[date, list[Workout]] = defaultdict(list)
    for w in db.scalars(
        select(Workout)
        .where(_between(Workout.date, start, end))
        .options(selectinload(Workout.exercises))
        .order_by(Workout.start_time)
    ):
        workouts[w.date].append(w)

    out = {}
    for day in date_range(start, end):
        d = daily.get(day)
        hr = hearts.get(day)
        out[day] = schemas.Fitness(
            calories_in=d.calories_in if d else None,
            calories_out=d.calories_out if d else None,
            active_calories=d.active_calories if d else None,
            basal_calories=d.basal_calories if d else None,
            steps=d.steps if d else None,
            macros=schemas.Macros(
                protein_g=d.protein_g if d else None,
                carbs_g=d.carbs_g if d else None,
                fat_g=d.fat_g if d else None,
            ),
            heart_rate=schemas.HeartRate.model_validate(hr) if hr else None,
            workouts=[schemas.WorkoutOut.model_validate(w) for w in workouts[day]],
        )
    return out


def sleep_heart_rate(db: Session, start: date, end: date) -> dict[date, schemas.SleepHeartRate]:
    """Lowest and highest heart rate between bedtime and wake time, per night."""
    rows = db.execute(
        select(Sleep.date, func.min(HeartRateSample.min), func.max(HeartRateSample.max))
        .join(
            HeartRateSample,
            (HeartRateSample.ts >= Sleep.bedtime) & (HeartRateSample.ts < Sleep.wake_time),
        )
        .where(_between(Sleep.date, start, end))
        .group_by(Sleep.date)
    )
    return {day: schemas.SleepHeartRate(min=lo, max=hi) for day, lo, hi in rows}


def sleep_by_day(db: Session, start: date, end: date) -> dict[date, schemas.SleepOut]:
    hearts = sleep_heart_rate(db, start, end)
    out = {}
    for r in db.scalars(select(Sleep).where(_between(Sleep.date, start, end))):
        night = schemas.SleepOut.model_validate(r)
        night.heart_rate = hearts.get(r.date)
        out[r.date] = night
    return out


def todos_by_day(db: Session, start: date, end: date) -> dict[date, schemas.TodoDay]:
    grouped: dict[date, list[Todo]] = defaultdict(list)
    for t in db.scalars(select(Todo).where(_between(Todo.date, start, end)).order_by(Todo.id)):
        grouped[t.date].append(t)
    return {
        day: schemas.TodoDay(
            tasks=[schemas.TaskOut.model_validate(t) for t in grouped[day]],
            done=sum(t.done for t in grouped[day]),
            total=len(grouped[day]),
        )
        for day in date_range(start, end)
    }


def summarize_trades(trades: list[Trade]) -> schemas.TradingSummary:
    wins = sum(t.result == "Profit" for t in trades)
    losses = sum(t.result == "Loss" for t in trades)
    decided = wins + losses
    return schemas.TradingSummary(
        wins=wins,
        losses=losses,
        breakeven=sum(t.result == "BE" for t in trades),
        win_rate=round(wins / decided * 100, 1) if decided else None,
    )


def trades_between(db: Session, start: date | None, end: date | None) -> list[Trade]:
    query = select(Trade)
    if start:
        query = query.where(Trade.date >= start)
    if end:
        query = query.where(Trade.date <= end)
    return list(db.scalars(query.order_by(Trade.date, Trade.id)))


def trading_by_day(db: Session, start: date, end: date) -> dict[date, schemas.Trading]:
    grouped: dict[date, list[Trade]] = defaultdict(list)
    for t in trades_between(db, start, end):
        grouped[t.date].append(t)
    return {
        day: schemas.Trading(
            trades=[schemas.TradeOut.model_validate(t) for t in grouped[day]],
            summary=summarize_trades(grouped[day]),
        )
        for day in date_range(start, end)
    }


def build_days(db: Session, start: date, end: date) -> list[schemas.Day]:
    fitness = fitness_by_day(db, start, end)
    sleep = sleep_by_day(db, start, end)
    todos = todos_by_day(db, start, end)
    trading = trading_by_day(db, start, end)
    return [
        schemas.Day(
            date=day,
            fitness=fitness[day],
            sleep=sleep.get(day),
            todo=todos[day],
            hobby=schemas.Hobby(trading=trading[day]),
        )
        for day in date_range(start, end)
    ]
