"""The evening food suggestion: if today's protein, carbs or fat are under target, ask an AI what to eat."""

import logging
from dataclasses import dataclass, field
from datetime import date

import httpx
from sqlalchemy.orm import Session

from app import schemas
from app.config import settings
from app.models import DailyFitness
from app.services.goals import get_goals
from app.services.mailer import send_email

logger = logging.getLogger(__name__)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MACROS = [("protein_g", "Protein"), ("carbs_g", "Carbs"), ("fat_g", "Fat")]


@dataclass
class MacroStatus:
    name: str
    eaten: float
    target: float
    short: float = 0  # grams to go, 0 when on target (within the tolerance for carbs and fat)
    over: float = 0  # grams above the target plus the tolerance


@dataclass
class FoodAlert:
    sent: bool = False
    skipped: str | None = None  # why nothing was sent
    subject: str = ""
    body: str = ""
    macros: list[MacroStatus] = field(default_factory=list)


def macro_status(day: DailyFitness | None, goals: schemas.GoalsIn, tolerance: float) -> list[MacroStatus]:
    """How today's protein, carbs and fat compare with the targets.

    Protein has to reach its target. Carbs and fat may sit up to `tolerance` grams under theirs.
    """
    out = []
    for column, name in MACROS:
        target = getattr(goals, column)
        if target is None:
            continue
        eaten = (getattr(day, column) if day else None) or 0
        gap = target - eaten  # positive: still to eat
        if column == "protein_g":
            short, over = max(gap, 0), 0
        else:
            short = gap if gap > tolerance else 0
            over = max(-gap - tolerance, 0)
        out.append(MacroStatus(name, round(eaten), round(target), round(short), round(over)))
    return out


def build_prompt(day: DailyFitness, goals: schemas.GoalsIn, macros: list[MacroStatus]) -> str:
    lines = [f"- {m.name}: {m.eaten} g of {m.target} g" for m in macros]
    missing = [f"{m.name.lower()} ({m.short} g short)" for m in macros if m.short]
    enough = [m.name.lower() for m in macros if not m.short]
    remaining = round(goals.calories_in - (day.calories_in or 0)) if goals.calories_in else None
    return (
        "I track my macros. Here is my day so far (it is about 23:00):\n"
        + "\n".join(lines)
        + (f"\n- Calories: {round(day.calories_in or 0)} kcal of {round(goals.calories_in)} kcal" if goals.calories_in else "")
        + f"\n\nStill missing: {', '.join(missing)}."
        + (f" Already covered, so avoid foods heavy in these: {', '.join(enough)}." if enough else "")
        + (f" About {remaining} kcal left in my budget." if remaining is not None and remaining > 0 else "")
        + "\n\nSuggest 2 or 3 simple foods or snacks that close the gap with as little of the other macros as possible, "
        "for example a low-fat high-protein yogurt or a protein shake. Give an amount and rough macros for each. "
        "It is late, so keep them light. Plain text, no markdown, under 120 words."
    )


def ask_ai(prompt: str) -> str | None:
    """The AI's suggestion, or None if there is no key or the call fails (the email then goes out without it)."""
    if not settings.anthropic_api_key:
        return None
    try:
        res = httpx.post(
            ANTHROPIC_URL,
            headers={"x-api-key": settings.anthropic_api_key, "anthropic-version": "2023-06-01"},
            json={"model": settings.anthropic_model, "max_tokens": 400, "messages": [{"role": "user", "content": prompt}]},
            timeout=30,
        )
        res.raise_for_status()
        return "".join(b.get("text", "") for b in res.json()["content"] if b.get("type") == "text").strip() or None
    except Exception:
        logger.exception("Food suggestion: the AI call failed")
        return None


def run_food_alert(db: Session, day: date, dry_run: bool = False) -> FoodAlert:
    """Checks `day` and emails a suggestion if something is missing. With dry_run nothing is sent (or asked of the AI)."""
    goals = get_goals(db)
    row = db.get(DailyFitness, day)
    result = FoodAlert()

    if row is None or not row.calories_in:
        result.skipped = "no food logged today"
        return result
    result.macros = macro_status(row, goals, settings.macro_tolerance_g)
    if not result.macros:
        result.skipped = "no macro goals set"
        return result
    if not any(m.short for m in result.macros):
        result.skipped = "on target"
        return result

    gaps = ", ".join(f"{m.short} g {m.name.lower()}" for m in result.macros if m.short)
    result.subject = f"Food check: {gaps} to go"
    summary = "\n".join(
        f"{m.name}: {m.eaten} / {m.target} g" + (f"  ({m.short} g to go)" if m.short else "") for m in result.macros
    )
    suggestion = None if dry_run else ask_ai(build_prompt(row, goals, result.macros))
    result.body = (
        f"Today ({day.isoformat()}) so far:\n{summary}\n\n"
        + (f"Ideas:\n{suggestion}\n" if suggestion else "(No AI suggestion available.)\n")
    )
    if not dry_run:
        send_email(result.subject, result.body)
        result.sent = True
    return result
