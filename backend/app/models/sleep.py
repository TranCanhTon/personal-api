from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Sleep(Base):
    """One night of sleep, keyed by the date you woke up."""

    __tablename__ = "sleep"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    bedtime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    wake_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    total_min: Mapped[float | None] = mapped_column(Float)
    deep_min: Mapped[float | None] = mapped_column(Float)
    rem_min: Mapped[float | None] = mapped_column(Float)
    core_min: Mapped[float | None] = mapped_column(Float)
    awake_min: Mapped[float | None] = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
