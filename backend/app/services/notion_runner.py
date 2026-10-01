import logging
import threading

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.services.db_utils import sync_run
from app.services.notion_client import NotionClient
from app.services.notion_sync import NotionSyncResult, sync_todos, sync_trades

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_rerun_requested = False


def run_notion_sync(db: Session) -> NotionSyncResult:
    """Syncs the to do list and the trading journal as two separate runs, so one failing doesn't block the other.

    Each part commits or rolls back on its own and has its own row in /sync/status
    ("notion" for to dos, "notion_trades" for trades). If any part failed, its error is raised after all ran.
    """
    client = NotionClient(settings.notion_token)
    result = NotionSyncResult()
    parts = [("notion", lambda: sync_todos(db, client, settings.notion_todo_page_id, result), lambda: result.todos)]
    if settings.notion_sync_trades:
        parts.append(
            ("notion_trades", lambda: sync_trades(db, client, settings.notion_trades_database_id, result), lambda: result.trades)
        )

    errors: list[Exception] = []
    try:
        for source, sync, records in parts:
            try:
                with sync_run(db, source) as log:
                    sync()
                    log.records = records()
            except Exception as exc:
                logger.exception("Notion sync failed: %s", source)
                errors.append(exc)
    finally:
        client.close()
    if errors:
        raise errors[0]
    return result


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
