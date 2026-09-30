import logging

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import require_api_key
from app.services.db_utils import save_raw, sync_run
from app.services.health_import import import_health_payload
from app.services.notion_runner import run_notion_sync

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["ingest"], dependencies=[Depends(require_api_key)])


@router.post("/health")
def ingest_health(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Receives Health Auto Export's REST API automation."""
    save_raw(db, "apple_health", payload)
    try:
        with sync_run(db, "apple_health") as log:
            result = import_health_payload(db, payload)
            log.records = result.records
    except (KeyError, ValueError, TypeError) as exc:
        logger.exception("Apple Health import failed")
        raise HTTPException(422, f"Could not read payload: {type(exc).__name__}: {exc}")

    if result.ignored_metrics:
        logger.info("Ignored metrics: %s", ", ".join(sorted(set(result.ignored_metrics))))
    return {
        "status": "ok",
        "days_fitness": result.days_fitness,
        "days_heart_rate": result.days_heart_rate,
        "heart_rate_samples": result.heart_rate_samples,
        "nights_sleep": result.nights_sleep,
        "workouts": result.workouts,
        "skipped_sleep_entries": result.skipped_sleep_entries,
        "ignored_metrics": sorted(set(result.ignored_metrics)),
    }


@router.post("/notion/sync")
def sync_notion_now(db: Session = Depends(get_db)):
    """Pulls the to do list and trading journal from Notion right now."""
    try:
        result = run_notion_sync(db)
    except ValueError as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        logger.exception("Notion sync failed")
        raise HTTPException(502, f"Notion sync failed: {type(exc).__name__}: {exc}")
    return {
        "status": "ok",
        "todo_days": result.todo_days,
        "todos": result.todos,
        "todos_deleted": result.todos_deleted,
        "trades": result.trades,
        "trades_deleted": result.trades_deleted,
        "skipped_databases": result.skipped_databases,
    }
