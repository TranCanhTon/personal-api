import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import settings
from app.database import SessionLocal
from app.services.db_utils import sync_run
from app.services.food_alert import run_food_alert
from app.services.weekly_report import run_weekly_report

logger = logging.getLogger(__name__)


def _today():
    return datetime.now(ZoneInfo(settings.timezone)).date()


def food_alert_job() -> None:
    db = SessionLocal()
    try:
        with sync_run(db, "food_alert") as log:
            result = run_food_alert(db, _today())
            log.records = int(result.sent)
        logger.info("Food alert: %s", "sent" if result.sent else f"skipped ({result.skipped})")
    finally:
        db.close()


def weekly_report_job() -> None:
    db = SessionLocal()
    try:
        with sync_run(db, "weekly_report") as log:
            run_weekly_report(db, _today())
            log.records = 1
        logger.info("Weekly report sent")
    finally:
        db.close()
