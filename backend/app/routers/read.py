from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas
from app.config import settings
from app.database import get_db
from app.models import ChessGame, SyncLog
from app.services import goals as goals_service
from app.services import read, streaks

router = APIRouter(tags=["read"])

MAX_RANGE_DAYS = 366


def date_window(
    start: date | None = Query(None, description="First day, YYYY-MM-DD. Defaults to 6 days before end."),
    end: date | None = Query(None, description="Last day, YYYY-MM-DD. Defaults to today."),
) -> tuple[date, date]:
    end = end or date.today()
    start = start or end - timedelta(days=6)
    if start > end:
        raise HTTPException(422, "start must be on or before end")
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(422, f"Range can be at most {MAX_RANGE_DAYS} days")
    return start, end


def today() -> date:
    """Today in the configured timezone, not the server's. AWS servers run on UTC."""
    return datetime.now(ZoneInfo(settings.timezone)).date()


def day_or_window(
    day: date | None = Query(None, alias="date", description="One day, YYYY-MM-DD. Defaults to today."),
    start: date | None = Query(None, description="First day of a range, YYYY-MM-DD. Use with end."),
    end: date | None = Query(None, description="Last day of a range, YYYY-MM-DD. Use with start."),
) -> tuple[date, date]:
    """Today by default. Pass date for one day, or start and end for a range."""
    if day and (start or end):
        raise HTTPException(422, "Use either date or start and end, not both")
    if start or end:
        if not (start and end):
            raise HTTPException(422, "start and end must be given together")
        return date_window(start, end)
    d = day or today()
    return d, d


@router.get("/days/{day}", response_model=schemas.Day, tags=["days"])
def get_day(day: date, db: Session = Depends(get_db)):
    """Everything for one day."""
    return read.build_days(db, day, day)[0]


@router.get("/days", response_model=list[schemas.Day], tags=["days"])
def get_days(window: tuple[date, date] = Depends(date_window), db: Session = Depends(get_db)):
    """Everything for each day in a range. Days with no data are still included."""
    return read.build_days(db, *window)


@router.get("/fitness", response_model=list[schemas.FitnessDay], tags=["fitness"])
def get_fitness(window: tuple[date, date] = Depends(day_or_window), db: Session = Depends(get_db)):
    """Today by default. Pass date for one day, or start and end for a range."""
    data = read.fitness_by_day(db, *window)
    return [schemas.FitnessDay(date=d, **f.model_dump()) for d, f in data.items()]


@router.get("/sleep", response_model=list[schemas.SleepDay], tags=["sleep"])
def get_sleep(window: tuple[date, date] = Depends(day_or_window), db: Session = Depends(get_db)):
    """Only nights that have data."""
    data = read.sleep_by_day(db, *window)
    return [schemas.SleepDay(date=d, **s.model_dump()) for d, s in sorted(data.items())]


@router.get("/todos", response_model=list[schemas.TodoDayOut], tags=["todo"])
def get_todos(window: tuple[date, date] = Depends(day_or_window), db: Session = Depends(get_db)):
    """Today by default. Pass date for one day, or start and end for a range."""
    data = read.todos_by_day(db, *window)
    return [schemas.TodoDayOut(date=d, **t.model_dump()) for d, t in data.items()]


@router.get("/trades", response_model=schemas.Trading, tags=["hobby"])
def get_trades(
    start: date | None = Query(None, description="First day, YYYY-MM-DD. Leave out for all time."),
    end: date | None = Query(None, description="Last day, YYYY-MM-DD. Leave out for all time."),
    db: Session = Depends(get_db),
):
    """Journal entries plus wins, losses and win rate. All time unless a range is given."""
    if start and end and start > end:
        raise HTTPException(422, "start must be on or before end")
    trades = read.trades_between(db, start, end)
    return schemas.Trading(
        trades=[schemas.TradeOut.model_validate(t) for t in trades],
        summary=read.summarize_trades(trades),
    )


@router.get("/games/chess", response_model=schemas.Chess, tags=["hobby"])
def get_chess(
    time_class: str = Query("rapid", pattern="^(rapid|blitz|bullet|daily)$", description="Which kind of game"),
    limit: int = Query(20, ge=1, le=200, description="Games per page"),
    offset: int = Query(0, ge=0, description="Games to skip, newest first"),
    db: Session = Depends(get_db),
):
    """chess.com: rating, record, colour and opening stats over every saved game, plus a page of games."""
    return read.chess_overview(db, time_class, limit, offset)


@router.get("/games/chess/{uuid}", response_model=schemas.ChessPgn, tags=["hobby"])
def get_chess_game(uuid: str, db: Session = Depends(get_db)):
    """The moves of one game, for replaying it on a board. Kept apart from the list so the list stays small."""
    game = db.get(ChessGame, uuid)
    if game is None or not game.pgn:
        raise HTTPException(404, "No moves saved for this game")
    return schemas.ChessPgn(uuid=game.uuid, pgn=game.pgn)


@router.get("/goals", response_model=schemas.GoalsIn, tags=["goals"])
def get_goals(db: Session = Depends(get_db)):
    """My targets (steps, calories, macros, sleep, workouts per week). Defaults until first saved."""
    return goals_service.get_goals(db)


@router.get("/streaks", response_model=schemas.Streaks, tags=["goals"])
def get_streaks(db: Session = Depends(get_db)):
    """Food logging streak in days and gym streak in weeks, as of today."""
    goals = goals_service.get_goals(db)
    return schemas.Streaks(
        food=streaks.food_streak(db, today()),
        gym=streaks.gym_streak(db, today(), goals.workouts_per_week),
    )


@router.get("/sync/status", response_model=list[schemas.SyncStatus], tags=["system"])
def sync_status(db: Session = Depends(get_db)):
    """The latest sync for each source."""
    latest = (
        select(SyncLog.source, func.max(SyncLog.id).label("id")).group_by(SyncLog.source).subquery()
    )
    rows = db.scalars(select(SyncLog).join(latest, SyncLog.id == latest.c.id).order_by(SyncLog.source))
    return [schemas.SyncStatus.model_validate(r, from_attributes=True) for r in rows]
