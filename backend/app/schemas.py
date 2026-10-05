import datetime as dt

from pydantic import BaseModel, ConfigDict, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- fitness ----------

class Macros(BaseModel):
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None


class HeartRateInterval(BaseModel):
    start: dt.datetime
    min: float | None = None
    max: float | None = None


class HeartRate(ORM):
    resting: float | None = None
    avg: float | None = None
    min: float | None = None
    max: float | None = None
    intervals: list[HeartRateInterval] = []  # every hour of the day that has readings


class Exercise(ORM):
    name: str
    sets: int | None = None
    reps: int | None = None
    weight_kg: float | None = None


class WorkoutHeartRate(BaseModel):
    min: float | None = None
    avg: float | None = None
    max: float | None = None


class WorkoutOut(ORM):
    id: int
    type: str
    start_time: dt.datetime
    end_time: dt.datetime
    duration_min: float
    calories: float | None = None
    heart_rate: WorkoutHeartRate | None = None  # min from per minute samples, avg and max from the workout
    exercises: list[Exercise] = []


class Fitness(BaseModel):
    calories_in: float | None = None
    calories_out: float | None = None
    active_calories: float | None = None
    basal_calories: float | None = None
    steps: int | None = None
    macros: Macros = Macros()
    heart_rate: HeartRate | None = None
    workouts: list[WorkoutOut] = []


# ---------- sleep ----------


class SleepHeartRate(BaseModel):
    min: float | None = None
    max: float | None = None
    intervals: list[HeartRateInterval] = []  # every 30 minutes of the night that has readings


class SleepOut(ORM):
    bedtime: dt.datetime | None = None
    wake_time: dt.datetime | None = None
    total_min: float | None = None
    deep_min: float | None = None
    rem_min: float | None = None
    core_min: float | None = None
    awake_min: float | None = None
    heart_rate: SleepHeartRate | None = None  # between bedtime and wake time


# ---------- to do ----------

class TaskOut(ORM):
    title: str
    done: bool


class TodoDay(BaseModel):
    tasks: list[TaskOut] = []
    done: int = 0
    total: int = 0


# ---------- hobby ----------

class TradeOut(ORM):
    date: dt.date | None = None
    entry: str | None = None
    result: str | None = None
    actual_rr: float | None = None
    intended_rr: float | None = None
    trade_quality: str | None = None
    followed_rules: bool | None = None
    bias_correct: str | None = None
    time_of_entry: str | None = None
    emotion: str | None = None
    execution: str | None = None
    note: str | None = None


class TradingSummary(BaseModel):
    wins: int = 0
    losses: int = 0
    breakeven: int = 0
    win_rate: float | None = None  # percent, wins / (wins + losses). None when there are no wins or losses


class Trading(BaseModel):
    trades: list[TradeOut] = []
    summary: TradingSummary = TradingSummary()


# ---------- goals and streaks ----------

class GoalsIn(BaseModel):
    """My targets. None switches a goal off."""

    steps: int | None = Field(None, gt=0, le=100_000)
    calories_in: float | None = Field(None, gt=0, le=10_000)
    protein_g: float | None = Field(None, gt=0, le=1_000)
    carbs_g: float | None = Field(None, gt=0, le=2_000)
    fat_g: float | None = Field(None, gt=0, le=1_000)
    sleep_hours: float | None = Field(None, gt=0, le=24)
    workouts_per_week: int | None = Field(None, gt=0, le=21)


class FoodStreak(BaseModel):
    current: int  # consecutive days with food logged. Today doesn't break it until the day is over
    best: int
    logged_today: bool


class GymStreak(BaseModel):
    current: int  # consecutive weeks (Monday to Sunday) with enough workouts. This week doesn't break it until it's over
    best: int
    this_week: int  # workouts so far this week
    target: int | None = None  # workouts per week, from the goals


class Streaks(BaseModel):
    food: FoodStreak
    gym: GymStreak


# ---------- chess ----------

class ChessGameOut(BaseModel):
    uuid: str
    url: str
    ended_at: dt.datetime
    date: dt.date  # local day the game ended
    time_class: str
    time_control: str
    rated: bool
    color: str
    rating: int  # mine, after the game
    rating_change: int | None = None  # vs my rating after the previous game of this time class
    opponent: str
    opponent_rating: int | None = None
    result: str  # mine, as chess.com words it: win, checkmated, resigned, timeout, ...
    opponent_result: str
    outcome: str  # win, loss or draw
    abandoned: bool
    opening: str | None = None
    eco: str | None = None


class ChessPgn(BaseModel):
    uuid: str
    pgn: str  # the whole game with its moves, in PGN


class ChessRecord(BaseModel):
    """Games that ended normally. Abandoned games are listed in the history but not counted here."""

    games: int = 0
    wins: int = 0
    losses: int = 0
    draws: int = 0
    win_rate: float | None = None  # percent, wins / games


class ChessSummary(ChessRecord):
    rating: int | None = None
    best_rating: int | None = None
    best_rating_date: dt.date | None = None
    abandoned: int = 0


class ChessOpening(ChessRecord):
    opening: str


class ChessRatingPoint(BaseModel):
    ended_at: dt.datetime
    rating: int


class Chess(BaseModel):
    time_class: str
    summary: ChessSummary = ChessSummary()
    white: ChessRecord = ChessRecord()
    black: ChessRecord = ChessRecord()
    openings: list[ChessOpening] = []  # most played first
    rating_history: list[ChessRatingPoint] = []  # oldest first
    total_games: int = 0  # every saved game of this time class, abandoned ones included
    games: list[ChessGameOut] = []  # newest first, one page


class Hobby(BaseModel):
    trading: Trading = Trading()


# ---------- a whole day ----------

class Day(BaseModel):
    date: dt.date
    fitness: Fitness
    sleep: SleepOut | None = None
    todo: TodoDay
    hobby: Hobby


# ---------- range endpoints ----------

class FitnessDay(Fitness):
    date: dt.date


class SleepDay(SleepOut):
    date: dt.date


class TodoDayOut(TodoDay):
    date: dt.date


class SyncStatus(BaseModel):
    source: str
    status: str
    started_at: dt.datetime
    finished_at: dt.datetime | None = None
    records: int
    error: str | None = None
