"""Builds the JSON the website reads, one day at a time, from all tables."""

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import schemas
from app.models import DailyFitness, HeartRateDaily, Sleep, Todo, Trade, Workout


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


def sleep_by_day(db: Session, start: date, end: date) -> dict[date, schemas.SleepOut]:
    return {
        r.date: schemas.SleepOut.model_validate(r)
        for r in db.scalars(select(Sleep).where(_between(Sleep.date, start, end)))
    }


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
    real = [t for t in trades if t.result != "No trade"]
    return schemas.TradingSummary(
        entries=len(real),
        profit=sum(t.result == "Profit" for t in trades),
        loss=sum(t.result == "Loss" for t in trades),
        breakeven=sum(t.result == "BE" for t in trades),
        no_trade=sum(t.result == "No trade" for t in trades),
        total_rr=round(sum(t.actual_rr or 0 for t in real), 2),
        rules_followed=sum(bool(t.followed_rules) for t in real),
    )


def trades_between(db: Session, start: date, end: date) -> list[Trade]:
    return list(db.scalars(select(Trade).where(_between(Trade.date, start, end)).order_by(Trade.date, Trade.id)))


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
