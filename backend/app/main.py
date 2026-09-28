from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.logging_config import configure_logging
from app.routers import health, ingest, read, webhooks

configure_logging()

app = FastAPI(
    title="Personal API",
    version="0.2.0",
    description="Apple Health and Notion data for one person, served as JSON.",
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
