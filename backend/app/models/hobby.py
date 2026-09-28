from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Trade(Base):
    """One entry from the Trade Recap database in the Notion trading journal."""

    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(primary_key=True)
    notion_page_id: Mapped[str] = mapped_column(String(64), unique=True)
    date: Mapped[date | None] = mapped_column(Date, index=True)
    entry: Mapped[str | None] = mapped_column(String(500))
    result: Mapped[str | None] = mapped_column(String(20))  # Profit, Loss, BE, No trade
    actual_rr: Mapped[float | None] = mapped_column(Float)
    intended_rr: Mapped[float | None] = mapped_column(Float)
    trade_quality: Mapped[str | None] = mapped_column(String(20))  # High, Mid, Low
    followed_rules: Mapped[bool | None] = mapped_column(Boolean)
    bias_correct: Mapped[str | None] = mapped_column(String(20))  # Yes, No, No bias
    time_of_entry: Mapped[str | None] = mapped_column(String(50))
    emotion: Mapped[str | None] = mapped_column(Text)
    execution: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
