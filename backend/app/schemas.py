import datetime as dt

from pydantic import BaseModel, ConfigDict


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- fitness ----------

class Macros(BaseModel):
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None


class HeartRate(ORM):
    resting: float | None = None
    avg: float | None = None
    min: float | None = None
    max: float | None = None


class Exercise(ORM):
    name: str
    sets: int | None = None
    reps: int | None = None
    weight_kg: float | None = None


class WorkoutOut(ORM):
    id: int
    type: str
    start_time: dt.datetime
    end_time: dt.datetime
    duration_min: float
    calories: float | None = None
    avg_heart_rate: float | None = None
    max_heart_rate: float | None = None
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

class SleepOut(ORM):
    bedtime: dt.datetime | None = None
    wake_time: dt.datetime | None = None
    total_min: float | None = None
    deep_min: float | None = None
    rem_min: float | None = None
    core_min: float | None = None
    awake_min: float | None = None


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
    entries: int = 0
    profit: int = 0
    loss: int = 0
    breakeven: int = 0
    no_trade: int = 0
    total_rr: float = 0
    rules_followed: int = 0


class Trading(BaseModel):
    trades: list[TradeOut] = []
    summary: TradingSummary = TradingSummary()


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
