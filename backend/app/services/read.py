"""Builds the JSON the website reads, one day at a time, from all tables."""

from collections import defaultdict
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app import schemas
from app.config import settings
from app.models import ChessGame, DailyFitness, HeartRateDaily, HeartRateSample, Sleep, Todo, Trade, Workout


def date_range(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def _between(column, start: date, end: date):
    return column.between(start, end)


def workout_min_heart_rate(db: Session, start: date, end: date) -> dict[int, float]:
    """Lowest heart rate between start and end of each workout, by workout id."""
    rows = db.execute(
        select(Workout.id, func.min(HeartRateSample.min))
        .join(
            HeartRateSample,
            (HeartRateSample.ts >= Workout.start_time) & (HeartRateSample.ts <= Workout.end_time),
        )
        .where(_between(Workout.date, start, end))
        .group_by(Workout.id)
    )
    return {workout_id: lo for workout_id, lo in rows if lo is not None}


def workout_out(w: Workout, hr_min: float | None) -> schemas.WorkoutOut:
    out = schemas.WorkoutOut.model_validate(w)
    if hr_min is not None or w.avg_heart_rate is not None or w.max_heart_rate is not None:
        out.heart_rate = schemas.WorkoutHeartRate(min=hr_min, avg=w.avg_heart_rate, max=w.max_heart_rate)
    return out


def _day_heart_rate(hr: HeartRateDaily | None, intervals: list[schemas.HeartRateInterval]) -> schemas.HeartRate | None:
    if hr is None and not intervals:
        return None
    out = schemas.HeartRate.model_validate(hr) if hr else schemas.HeartRate()
    out.intervals = intervals
    return out


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
    workout_mins = workout_min_heart_rate(db, start, end)
    hr_intervals = day_heart_rate_intervals(db, start, end)

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
            heart_rate=_day_heart_rate(hr, hr_intervals.get(day, [])),
            workouts=[workout_out(w, workout_mins.get(w.id)) for w in workouts[day]],
        )
    return out


def _interval_start(ts: datetime, minutes: int) -> datetime:
    """Start of the clock interval the sample falls in, e.g. half hours: 05:23 -> 05:00, 05:41 -> 05:30."""
    return ts.replace(minute=ts.minute - ts.minute % minutes, second=0, microsecond=0)


def _lowest(values: list[float | None]) -> float | None:
    present = [v for v in values if v is not None]
    return min(present) if present else None


def _highest(values: list[float | None]) -> float | None:
    present = [v for v in values if v is not None]
    return max(present) if present else None


def _heart_rate_intervals(rows, minutes: int) -> dict[date, list[schemas.HeartRateInterval]]:
    """(day, ts, min, max) rows, sorted by time -> lowest and highest per clock interval, per day."""
    days: dict[date, dict[datetime, tuple[list, list]]] = defaultdict(dict)
    for day, ts, lo, hi in rows:
        lows, highs = days[day].setdefault(_interval_start(ts, minutes), ([], []))
        lows.append(lo)
        highs.append(hi)
    return {
        day: [
            schemas.HeartRateInterval(start=slot, min=_lowest(lows), max=_highest(highs))
            for slot, (lows, highs) in slots.items()
        ]
        for day, slots in days.items()
    }


def day_heart_rate_intervals(db: Session, start: date, end: date) -> dict[date, list[schemas.HeartRateInterval]]:
    """Lowest and highest heart rate per hour, for each day in the configured timezone."""
    tz = ZoneInfo(settings.timezone)
    rows = db.execute(
        select(HeartRateSample.ts, HeartRateSample.min, HeartRateSample.max)
        .where(HeartRateSample.ts >= datetime.combine(start, time.min, tz))
        .where(HeartRateSample.ts < datetime.combine(end + timedelta(days=1), time.min, tz))
        .order_by(HeartRateSample.ts)
    )
    local = ((ts.astimezone(tz).date(), ts.astimezone(tz), lo, hi) for ts, lo, hi in rows)
    return _heart_rate_intervals(local, 60)


def sleep_heart_rate(db: Session, start: date, end: date) -> dict[date, schemas.SleepHeartRate]:
    """Lowest and highest heart rate between bedtime and wake time, per night and per half hour."""
    rows = db.execute(
        select(Sleep.date, HeartRateSample.ts, HeartRateSample.min, HeartRateSample.max)
        .join(
            HeartRateSample,
            (HeartRateSample.ts >= Sleep.bedtime) & (HeartRateSample.ts < Sleep.wake_time),
        )
        .where(_between(Sleep.date, start, end))
        .order_by(Sleep.date, HeartRateSample.ts)
    )
    out = {}
    for day, intervals in _heart_rate_intervals(rows, 30).items():
        out[day] = schemas.SleepHeartRate(
            min=_lowest([i.min for i in intervals]),
            max=_highest([i.max for i in intervals]),
            intervals=intervals,
        )
    return out


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


def _chess_record(games: list[ChessGame]) -> schemas.ChessRecord:
    """Record over games that ended normally."""
    counted = [g for g in games if not g.abandoned]
    wins = sum(g.outcome == "win" for g in counted)
    return schemas.ChessRecord(
        games=len(counted),
        wins=wins,
        losses=sum(g.outcome == "loss" for g in counted),
        draws=sum(g.outcome == "draw" for g in counted),
        win_rate=round(wins / len(counted) * 100, 1) if counted else None,
    )


def chess_overview(db: Session, time_class: str, limit: int, offset: int) -> schemas.Chess:
    """Rating, record, colour and opening stats over every saved game of a time class, plus one page of games."""
    tz = ZoneInfo(settings.timezone)
    games = list(db.scalars(select(ChessGame).where(ChessGame.time_class == time_class).order_by(ChessGame.ended_at)))
    if not games:
        return schemas.Chess(time_class=time_class)

    best = max(games, key=lambda g: (g.rating, g.ended_at))
    summary = schemas.ChessSummary(
        **_chess_record(games).model_dump(),
        rating=games[-1].rating,
        best_rating=best.rating,
        best_rating_date=best.ended_at.astimezone(tz).date(),
        abandoned=sum(g.abandoned for g in games),
    )

    by_opening: dict[str, list[ChessGame]] = defaultdict(list)
    for g in games:
        if not g.abandoned:
            by_opening[g.opening or "Unknown"].append(g)
    openings = sorted(
        (schemas.ChessOpening(opening=name, **_chess_record(items).model_dump()) for name, items in by_opening.items()),
        key=lambda o: (-o.games, o.opening),
    )[:8]

    previous = {games[i].uuid: games[i - 1].rating for i in range(1, len(games))}
    page = sorted(games, key=lambda g: g.ended_at, reverse=True)[offset : offset + limit]
    return schemas.Chess(
        time_class=time_class,
        summary=summary,
        white=_chess_record([g for g in games if g.color == "white"]),
        black=_chess_record([g for g in games if g.color == "black"]),
        openings=openings,
        rating_history=[schemas.ChessRatingPoint(ended_at=g.ended_at.astimezone(tz), rating=g.rating) for g in games],
        total_games=len(games),
        games=[
            schemas.ChessGameOut(
                date=g.ended_at.astimezone(tz).date(),
                ended_at=g.ended_at.astimezone(tz),
                rating_change=g.rating - previous[g.uuid] if g.uuid in previous else None,
                **{c: getattr(g, c) for c in (
                    "uuid", "url", "time_class", "time_control", "rated", "color", "rating", "opponent",
                    "opponent_rating", "result", "opponent_result", "outcome", "abandoned", "opening", "eco",
                )},
            )
            for g in page
        ],
    )
