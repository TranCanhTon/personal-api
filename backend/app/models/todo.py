from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Todo(Base):
    """A task from one of the daily to do databases in Notion."""

    __tablename__ = "todos"

    id: Mapped[int] = mapped_column(primary_key=True)
    notion_page_id: Mapped[str] = mapped_column(String(64), unique=True)
    notion_database_id: Mapped[str] = mapped_column(String(64), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    title: Mapped[str] = mapped_column(String(500))
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
