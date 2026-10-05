from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ChessGame(Base):
    """One chess.com game, from my side: my colour, rating and result."""

    __tablename__ = "chess_games"

    uuid: Mapped[str] = mapped_column(String(40), primary_key=True)
    url: Mapped[str] = mapped_column(String(200))
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    time_class: Mapped[str] = mapped_column(String(20), index=True)  # rapid, blitz, bullet, daily
    time_control: Mapped[str] = mapped_column(String(20))  # e.g. 600, or 600+5
    rated: Mapped[bool] = mapped_column(Boolean)
    color: Mapped[str] = mapped_column(String(5))  # white or black
    rating: Mapped[int] = mapped_column(Integer)  # mine, after the game
    opponent: Mapped[str] = mapped_column(String(60))
    opponent_rating: Mapped[int | None] = mapped_column(Integer)
    result: Mapped[str] = mapped_column(String(30))  # mine as chess.com says it: win, checkmated, resigned, timeout, abandoned, ...
    opponent_result: Mapped[str] = mapped_column(String(30))
    outcome: Mapped[str] = mapped_column(String(5))  # win, loss or draw
    abandoned: Mapped[bool] = mapped_column(Boolean, default=False)  # either side left the game
    opening: Mapped[str | None] = mapped_column(String(100))  # family, e.g. Scandinavian Defense
    eco: Mapped[str | None] = mapped_column(String(10))
