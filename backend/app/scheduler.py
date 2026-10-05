"""Runs background jobs on a timer: the Notion pull every few minutes, and the emails at a set time of day."""

import asyncio
import logging
from collections.abc import Callable
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)


async def run_every(interval_seconds: float, job: Callable[[], None]) -> None:
    """Runs `job` in a worker thread every `interval_seconds`, forever, until cancelled."""
    while True:
        try:
            await asyncio.to_thread(job)
        except Exception:
            logger.exception("Scheduled job crashed")
        await asyncio.sleep(interval_seconds)


def next_run(now: datetime, at: time, weekday: int | None = None) -> datetime:
    """The next time the clock reads `at` (in now's zone), on `weekday` (Monday is 0) or any day."""
    candidate = datetime.combine(now.date(), at, tzinfo=now.tzinfo)
    while candidate <= now or (weekday is not None and candidate.weekday() != weekday):
        candidate += timedelta(days=1)
    return candidate


async def run_daily(at: time, timezone: str, job: Callable[[], None], weekday: int | None = None) -> None:
    """Runs `job` in a worker thread every day at `at` local time (or weekly on `weekday`), forever, until cancelled."""
    tz = ZoneInfo(timezone)
    while True:
        now = datetime.now(tz)
        await asyncio.sleep((next_run(now, at, weekday) - now).total_seconds())
        try:
            await asyncio.to_thread(job)
        except Exception:
            logger.exception("Scheduled job crashed")

