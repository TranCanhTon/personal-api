"""Tests run against a real Postgres database, because the app relies on Postgres upserts and JSONB.

Point TEST_DATABASE_URL at an empty database. It is migrated with Alembic at
the start and wiped between tests.
"""

import os

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/personal_api_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["INGEST_API_KEY"] = "test-key"
os.environ["NOTION_TOKEN"] = "test-notion-token"
os.environ["NOTION_WEBHOOK_SECRET"] = "test-webhook-secret"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUTH = {"X-API-Key": "test-key"}


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "migrations"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield
    command.downgrade(cfg, "base")


@pytest.fixture(autouse=True)
def clean_tables():
    yield
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
def client():
    app.dependency_overrides.clear()
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()
