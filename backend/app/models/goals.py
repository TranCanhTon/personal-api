from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Goals(Base):
    """My targets. A single row (id 1). A column left empty means that goal is switched off."""

    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    steps: Mapped[int | None] = mapped_column(Integer)
    calories_in: Mapped[float | None] = mapped_column(Float)
    protein_g: Mapped[float | None] = mapped_column(Float)
    carbs_g: Mapped[float | None] = mapped_column(Float)
    fat_g: Mapped[float | None] = mapped_column(Float)
    sleep_hours: Mapped[float | None] = mapped_column(Float)
    workouts_per_week: Mapped[int | None] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
