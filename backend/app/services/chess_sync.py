import logging
import re
from datetime import datetime, timezone
from typing import Any, Protocol

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import ChessGame
from app.services.chess_client import ChessClient
from app.services.db_utils import sync_run, upsert

logger = logging.getLogger(__name__)

# How chess.com words a drawn game, in the result of either player
DRAW_RESULTS = {"agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"}
# After the first sync only the newest months are read: games can't change once their month is over
RECENT_MONTHS = 2
# The opening name ends at one of these words, e.g. "Kings Pawn Opening" in Kings-Pawn-Opening-Leonardis-Variation
OPENING_ENDINGS = {"Opening", "Defense", "Defence", "Game", "Gambit", "Attack", "System"}


class _Client(Protocol):
    def archives(self, username: str) -> list[str]: ...
    def month(self, archive_url: str) -> list[dict[str, Any]]: ...


def opening_family(eco_url: str | None) -> str | None:
    """'.../Kings-Pawn-Opening-Leonardis-Variation' -> 'Kings Pawn Opening'. Variations are folded into the family."""
    if not eco_url:
        return None
    words = []
    for word in eco_url.rsplit("/", 1)[-1].split("-"):
        if re.match(r"\d+\.", word):  # a move such as 2...d5 starts the variation
            break
        words.append(word)
        if word in OPENING_ENDINGS:
            break
    name = " ".join(words)
    return None if not name or name == "Undefined" else name


def outcome_of(result: str) -> str:
    if result == "win":
        return "win"
    return "draw" if result in DRAW_RESULTS else "loss"


def game_row(game: dict[str, Any], username: str) -> dict[str, Any] | None:
    """My row from one chess.com game, or None for a game I wasn't in or a variant (chess960 and so on)."""
    if game.get("rules", "chess") != "chess":
        return None
    white, black = game["white"], game["black"]
    if white["username"].lower() == username.lower():
        color, me, opp = "white", white, black
    elif black["username"].lower() == username.lower():
        color, me, opp = "black", black, white
    else:
        return None
    eco = re.search(r'\[ECO "([^"]+)"\]', game.get("pgn", ""))
    return {
        "uuid": game["uuid"],
        "url": game["url"],
        "ended_at": datetime.fromtimestamp(game["end_time"], tz=timezone.utc),
        "time_class": game["time_class"],
        "time_control": game["time_control"],
        "rated": bool(game.get("rated", True)),
        "color": color,
        "rating": me["rating"],
        "opponent": opp["username"],
        "opponent_rating": opp.get("rating"),
        "result": me["result"],
        "opponent_result": opp["result"],
        "outcome": outcome_of(me["result"]),
        "abandoned": "abandoned" in (me["result"], opp["result"]),
        "opening": opening_family(game.get("eco")),
        "eco": eco.group(1) if eco else None,
    }


def sync_chess(db: Session, client: _Client, username: str) -> int:
    """Saves games we don't have yet. Returns how many were added."""
    months = client.archives(username)
    if db.scalar(select(func.count()).select_from(ChessGame)):
        months = months[-RECENT_MONTHS:]  # already synced once, so only the months that can still change
    added = 0
    for url in months:
        games = client.month(url)
        rows = [r for r in (game_row(g, username) for g in games) if r]
        known = set(db.scalars(select(ChessGame.uuid).where(ChessGame.uuid.in_([r["uuid"] for r in rows]))))
        for row in rows:
            upsert(db, ChessGame, row, key=["uuid"])
        db.commit()  # keep progress if a later month fails
        added += sum(r["uuid"] not in known for r in rows)
    return added


def run_chess_sync() -> int:
    """One sync run, with its own row in /sync/status ("chess")."""
    db = SessionLocal()
    client = ChessClient()
    try:
        with sync_run(db, "chess") as log:
            log.records = sync_chess(db, client, settings.chess_username)
        logger.info("Chess sync ok: %s new games", log.records)
        return log.records
    finally:
        client.close()
        db.close()
