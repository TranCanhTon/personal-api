"""Pulls from Notion on a timer, so ticking a box in Notion shows up without calling the sync endpoint."""

import asyncio
import logging
from collections.abc import Callable

logger = logging.getLogger(__name__)


async def run_every(interval_seconds: float, job: Callable[[], None]) -> None:
    """Runs `job` in a worker thread every `interval_seconds`, forever, until cancelled."""
    while True:
        try:
            await asyncio.to_thread(job)
        except Exception:
            logger.exception("Scheduled job crashed")
        await asyncio.sleep(interval_seconds)