from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import RawPayload, SyncLog


def upsert(db: Session, model, row: dict[str, Any], key: list[str]) -> None:
    """Insert a row, or update only the columns present in `row` if the key already exists."""
    stmt = insert(model).values(**row)
    update_cols = {c: stmt.excluded[c] for c in row if c not in key}
    if update_cols:
        stmt = stmt.on_conflict_do_update(index_elements=key, set_=update_cols)
    else:
        stmt = stmt.on_conflict_do_nothing(index_elements=key)
    db.execute(stmt)


def save_raw(db: Session, source: str, payload: dict) -> None:
    """Stored and committed on its own so the original data survives a parsing bug."""
    db.add(RawPayload(source=source, payload=payload))
    db.commit()


@contextmanager
def sync_run(db: Session, source: str) -> Iterator[SyncLog]:
    """Records a sync in sync_log. Commits the data on success, rolls it back on failure."""
    log = SyncLog(source=source, status="running")
    db.add(log)
    db.commit()
    try:
        yield log
        log.status = "ok"
        log.finished_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as exc:
        db.rollback()
        log.status = "error"
        log.error = f"{type(exc).__name__}: {exc}"[:2000]
        log.finished_at = datetime.now(timezone.utc)
        db.add(log)
        db.commit()
        raise
