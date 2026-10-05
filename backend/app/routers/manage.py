from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.routers.read import today
from app.security import require_api_key
from app.services import goals as goals_service
from app.services.food_alert import run_food_alert
from app.services.weekly_report import run_weekly_report

router = APIRouter(tags=["manage"], dependencies=[Depends(require_api_key)])

DRY_RUN = Query(False, description="Work out what would be sent, but send nothing")


@router.put("/goals", response_model=schemas.GoalsIn)
def put_goals(goals: schemas.GoalsIn, db: Session = Depends(get_db)):
    """Replaces my targets. A field set to null switches that goal off."""
    return goals_service.save_goals(db, goals)


@router.post("/alerts/food-suggestion")
def trigger_food_suggestion(dry_run: bool = DRY_RUN, db: Session = Depends(get_db)):
    """Runs the evening food check now, instead of waiting for the scheduled time."""
    result = run_food_alert(db, today(), dry_run=dry_run)
    return {
        "sent": result.sent,
        "skipped": result.skipped,
        "subject": result.subject,
        "body": result.body,
        "macros": [m.__dict__ for m in result.macros],
    }


@router.post("/alerts/weekly-report")
def trigger_weekly_report(dry_run: bool = DRY_RUN, db: Session = Depends(get_db)):
    """Builds and sends this week's report now."""
    subject, body, sent = run_weekly_report(db, today(), dry_run=dry_run)
    return {"sent": sent, "subject": subject, "body": body}
