from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DailyFitness(Base):
    """One row per day. Totals from Apple Health (Lifesum feeds the intake side)."""

    __tablename__ = "daily_fitness"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    calories_in: Mapped[float | None] = mapped_column(Float)
    active_calories: Mapped[float | None] = mapped_column(Float)
    basal_calories: Mapped[float | None] = mapped_column(Float)
    steps: Mapped[int | None] = mapped_column(Integer)
    protein_g: Mapped[float | None] = mapped_column(Float)
    carbs_g: Mapped[float | None] = mapped_column(Float)
    fat_g: Mapped[float | None] = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def calories_out(self) -> float | None:
        if self.active_calories is None and self.basal_calories is None:
            return None
        return (self.active_calories or 0) + (self.basal_calories or 0)


class HeartRateDaily(Base):
    __tablename__ = "heart_rate_daily"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    resting: Mapped[float | None] = mapped_column(Float)
    avg: Mapped[float | None] = mapped_column(Float)
    min: Mapped[float | None] = mapped_column(Float)
    max: Mapped[float | None] = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class HeartRateSample(Base):
    """Heart rate per time bucket as exported (one per minute with Minutes aggregation).

    Kept so heart rate can be read for any window, like a night of sleep.
    """

    __tablename__ = "heart_rate_samples"

    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    min: Mapped[float | None] = mapped_column(Float)
    avg: Mapped[float | None] = mapped_column(Float)
    max: Mapped[float | None] = mapped_column(Float)


class Workout(Base):
    """A workout session recorded by the Apple Watch."""

    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[str] = mapped_column(String(100), unique=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    type: Mapped[str] = mapped_column(String(100))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_min: Mapped[float] = mapped_column(Float)
    calories: Mapped[float | None] = mapped_column(Float)
    avg_heart_rate: Mapped[float | None] = mapped_column(Float)
    max_heart_rate: Mapped[float | None] = mapped_column(Float)

    exercises: Mapped[list["WorkoutExercise"]] = relationship(
        back_populates="workout", cascade="all, delete-orphan", passive_deletes=True
    )


class WorkoutExercise(Base):
    """What was done inside a workout. Filled from Notion workout logs."""

    __tablename__ = "workout_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    workout_id: Mapped[int] = mapped_column(
        ForeignKey("workouts.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    sets: Mapped[int | None] = mapped_column(Integer)
    reps: Mapped[int | None] = mapped_column(Integer)
    weight_kg: Mapped[float | None] = mapped_column(Float)
    notion_page_id: Mapped[str | None] = mapped_column(String(64), unique=True)

    workout: Mapped[Workout] = relationship(back_populates="exercises")
