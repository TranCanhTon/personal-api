"""Pulls the to do list and the trading journal from Notion into our tables.

To Do: the "To Do List" page holds one inline database per day, titled with
the date (e.g. "28.09.2026" or "11/09/2026 - YOU HAVE TO LOCK IN").
Each has a title property (the task) and a checkbox (done).

Trading: the "Trade Recap" database in the Trading Journal.

Every sync is a full refresh: rows are upserted, and rows whose Notion page
no longer exists are deleted.
"""

import re
from dataclasses import dataclass
from datetime import date
from typing import Any, Protocol

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import Todo, Trade
from app.services.db_utils import upsert

DATE_IN_TITLE = re.compile(r"(\d{1,2})[./-](\d{1,2})[./-](\d{4})")


class NotionSource(Protocol):
    def child_databases(self, page_id: str) -> list[dict[str, Any]]: ...
    def query_database(self, database_id: str) -> list[dict[str, Any]]: ...


@dataclass
class NotionSyncResult:
    todo_days: int = 0
    todos: int = 0
    todos_deleted: int = 0
    trades: int = 0
    trades_deleted: int = 0
    skipped_databases: list[str] | None = None

    @property
    def records(self) -> int:
        return self.todos + self.trades


# ---------- property readers ----------

def _plain(rich: list[dict] | None) -> str:
    return "".join(part.get("plain_text", "") for part in rich or []).strip()


def _prop(page: dict, name: str) -> dict:
    return page.get("properties", {}).get(name) or {}


def title_of(page: dict) -> str:
    for prop in page.get("properties", {}).values():
        if prop.get("type") == "title":
            return _plain(prop.get("title"))
    return ""


def first_checkbox(page: dict) -> bool:
    for prop in page.get("properties", {}).values():
        if prop.get("type") == "checkbox":
            return bool(prop.get("checkbox"))
    return False


def text(page: dict, name: str) -> str | None:
    return _plain(_prop(page, name).get("rich_text")) or None


def number(page: dict, name: str) -> float | None:
    return _prop(page, name).get("number")


def select(page: dict, name: str) -> str | None:
    value = _prop(page, name).get("select")
    return value.get("name") if value else None


def date_value(page: dict, name: str) -> date | None:
    value = _prop(page, name).get("date")
    if not value or not value.get("start"):
        return None
    return date.fromisoformat(value["start"][:10])


def date_from_title(title: str) -> date | None:
    """Day first, as in 28.09.2026 or 11/09/2026."""
    match = DATE_IN_TITLE.search(title)
    if not match:
        return None
    day, month, year = (int(g) for g in match.groups())
    try:
        return date(year, month, day)
    except ValueError:
        return None


def yes_no(value: str | None) -> bool | None:
    if value is None:
        return None
    return value.strip().lower() == "yes"


# ---------- syncs ----------

def sync_todos(db: Session, notion: NotionSource, todo_page_id: str, result: NotionSyncResult) -> None:
    seen_pages: list[str] = []
    skipped: list[str] = []

    for database in notion.child_databases(todo_page_id):
        day = date_from_title(database["title"])
        if day is None:
            skipped.append(database["title"])
            continue
        result.todo_days += 1
        for page in notion.query_database(database["id"]):
            if page.get("archived") or page.get("in_trash"):
                continue
            upsert(db, Todo, {
                "notion_page_id": page["id"],
                "notion_database_id": database["id"],
                "date": day,
                "title": title_of(page)[:500] or "(untitled)",
                "done": first_checkbox(page),
            }, key=["notion_page_id"])
            seen_pages.append(page["id"])

    removed = db.execute(delete(Todo).where(Todo.notion_page_id.not_in(seen_pages)))
    result.todos = len(seen_pages)
    result.todos_deleted = removed.rowcount or 0
    result.skipped_databases = skipped


def sync_trades(db: Session, notion: NotionSource, trades_database_id: str, result: NotionSyncResult) -> None:
    seen_pages: list[str] = []

    for page in notion.query_database(trades_database_id):
        if page.get("archived") or page.get("in_trash"):
            continue
        upsert(db, Trade, {
            "notion_page_id": page["id"],
            "date": date_value(page, "Date"),
            "entry": title_of(page)[:500] or None,
            "result": select(page, "PnL"),
            "actual_rr": number(page, "Actual RR"),
            "intended_rr": number(page, "Intended RR"),
            "trade_quality": select(page, "Trade quality"),
            "followed_rules": yes_no(select(page, "Did you follow your rules?")),
            "bias_correct": select(page, "Bias correct?"),
            "time_of_entry": text(page, "Time of entry"),
            "emotion": text(page, "Emotion"),
            "execution": text(page, "Execution"),
            "note": text(page, "Note"),
        }, key=["notion_page_id"])
        seen_pages.append(page["id"])

    removed = db.execute(delete(Trade).where(Trade.notion_page_id.not_in(seen_pages)))
    result.trades = len(seen_pages)
    result.trades_deleted = removed.rowcount or 0
