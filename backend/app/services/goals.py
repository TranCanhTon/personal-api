from sqlalchemy.orm import Session

from app import schemas
from app.models import Goals
from app.services.db_utils import upsert

GOALS_ID = 1

# Used until goals are saved for the first time. Carbs and fat are the 2:1 split of what
# protein leaves of 2,500 kcal: (2,500 - 150 * 4) / 3 = 633 kcal per share -> 317 g carbs, 70 g fat.
DEFAULT_GOALS = schemas.GoalsIn(
    steps=10_000,
    calories_in=2_500,
    protein_g=150,
    carbs_g=317,
    fat_g=70,
    sleep_hours=8,
    workouts_per_week=4,
)


def get_goals(db: Session) -> schemas.GoalsIn:
    row = db.get(Goals, GOALS_ID)
    if row is None:
        return DEFAULT_GOALS
    return schemas.GoalsIn.model_validate(row, from_attributes=True)


def save_goals(db: Session, goals: schemas.GoalsIn) -> schemas.GoalsIn:
    upsert(db, Goals, {"id": GOALS_ID, **goals.model_dump()}, key=["id"])
    db.commit()
    return get_goals(db)
