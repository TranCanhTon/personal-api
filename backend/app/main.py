import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from datetime import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.logging_config import configure_logging
from app.routers import health, ingest, manage, read, webhooks
from app.scheduler import run_daily, run_every
from app.services.chess_sync import run_chess_sync
from app.services.email_jobs import food_alert_job, weekly_report_job
from app.services.mailer import email_configured
from app.services.notion_runner import run_notion_sync_in_background

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    tasks = []
    minutes = settings.notion_sync_interval_minutes
    if minutes > 0 and settings.notion_token:
        logger.info("Scheduled Notion sync every %s minutes", minutes)
        tasks.append(asyncio.create_task(run_every(minutes * 60, run_notion_sync_in_background)))
    else:
        logger.info("Scheduled Notion sync is off")
    chess_minutes = settings.chess_sync_interval_minutes
    if chess_minutes > 0 and settings.chess_username:
        logger.info("Scheduled chess.com sync every %s minutes", chess_minutes)
        tasks.append(asyncio.create_task(run_every(chess_minutes * 60, run_chess_sync)))
    else:
        logger.info("Scheduled chess.com sync is off")
    if email_configured():
        food_at = time.fromisoformat(settings.food_alert_time)
        report_at = time.fromisoformat(settings.weekly_report_time)
        logger.info("Scheduled food suggestion daily at %s and weekly report on Sundays at %s", food_at, report_at)
        tasks.append(asyncio.create_task(run_daily(food_at, settings.timezone, food_alert_job)))
        tasks.append(asyncio.create_task(run_daily(report_at, settings.timezone, weekly_report_job, weekday=6)))
    else:
        logger.info("Scheduled emails are off (SMTP_USER / SMTP_PASSWORD not set)")
    yield
    for task in tasks:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="Personal API",
    version="0.3.0",
    description="Apple Health and Notion data for one person, served as JSON.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "PUT"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(read.router)
app.include_router(ingest.router)
app.include_router(manage.router)
app.include_router(webhooks.router)