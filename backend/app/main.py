import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.logging_config import configure_logging
from app.routers import health, ingest, read, webhooks
from app.scheduler import run_every
from app.services.notion_runner import run_notion_sync_in_background

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = None
    minutes = settings.notion_sync_interval_minutes
    if minutes > 0 and settings.notion_token:
        logger.info("Scheduled Notion sync every %s minutes", minutes)
        task = asyncio.create_task(run_every(minutes * 60, run_notion_sync_in_background))
    else:
        logger.info("Scheduled Notion sync is off")
    yield
    if task:
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
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(read.router)
app.include_router(ingest.router)
app.include_router(webhooks.router)