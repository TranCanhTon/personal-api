import logging
import threading

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.services.db_utils import sync_run
from app.services.notion_client import NotionClient
from app.services.notion_sync import NotionSyncResult, sync_notion

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_rerun_requested = False


def run_notion_sync(db: Session) -> NotionSyncResult:
    client = NotionClient(settings.notion_token)
    try:
        with sync_run(db, "notion") as log:
            result = sync_notion(
                db,
                client,
                settings.notion_todo_page_id,
                settings.notion_trades_database_id,
                include_trades=settings.notion_sync_trades,
            )
            log.records = result.records
        return result
    finally:
        client.close()


def run_notion_sync_in_background() -> None:
    """Webhooks can arrive in bursts. Run one sync at a time, and one more if events came in meanwhile."""
    global _rerun_requested
    if not _lock.acquire(blocking=False):
        _rerun_requested = True
        return
    try:
        while True:
            _rerun_requested = False
            db = SessionLocal()
            try:
                result = run_notion_sync(db)
                logger.info("Notion sync ok: %s todos, %s trades", result.todos, result.trades)
            except Exception:
                logger.exception("Notion sync failed")
            finally:
                db.close()
            if not _rerun_requested:
                break
    finally:
        _lock.release()
