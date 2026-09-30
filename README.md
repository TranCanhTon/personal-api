# Personal API

A JSON API for my own life data. Apple Health (sleep, heart rate, workouts,
steps, calories in and out via Lifesum) and Notion (to do list, trading
journal) flow into one Postgres database, served by FastAPI.

**Stack:** Python, FastAPI, PostgreSQL, Alembic, Docker, AWS, Terraform, GitHub Actions, Ansible

## How data gets in

```
iPhone / Apple Watch ─┐
Lifesum ─► Apple Health ─► Health Auto Export ──POST /ingest/health──┐
                                                                     ├─► FastAPI ─► Postgres ─► GET /days, /fitness, ...
Notion ──webhook /webhooks/notion (or POST /ingest/notion/sync)──────┘
```

- Every write needs the `X-API-Key` header. Reads are public.
- Every payload is stored untouched in `raw_payloads` before parsing.
- Every sync run is recorded in `sync_log`, visible at `GET /sync/status`.
- Sending the same data twice is safe: rows are upserted, not duplicated.

## Categories

| Category | Data | Source |
|---|---|---|
| Fitness | Calories in and out, macros, steps, heart rate, workouts | Apple Health |
| Sleep | Sleep stages, duration, heart rate while asleep (min, max) | Apple Health |
| To Do | Daily task lists | Notion |
| Hobby | Trading journal (Trade Recap) | Notion |

## Endpoints

| Method | Path | What |
|---|---|---|
| GET | `/days/{date}` | Everything for one day |
| GET | `/days?start=&end=` | Everything per day in a range (default last 7 days) |
| GET | `/fitness?date=` or `/fitness?start=&end=` | Fitness per day, today by default |
| GET | `/sleep?start=&end=` | Nights with sleep data |
| GET | `/todos?date=` or `/todos?start=&end=` | Tasks per day, today by default |
| GET | `/trades?start=&end=` | Journal entries and a summary |
| GET | `/sync/status` | Latest sync per source |
| GET | `/health` | API and database status |
| POST | `/ingest/health` | Health Auto Export sends data here (API key) |
| POST | `/ingest/notion/sync` | Pull from Notion now (API key) |
| POST | `/webhooks/notion` | Notion calls this on changes (signed) |

Full interactive docs at `/docs` when running.

## Run locally

Needs Docker Desktop.

```bash
cp .env.example .env        # then fill in your own values
docker compose up --build
```

The database schema is created automatically by Alembic on startup.

- API: http://localhost:8000
- Docs: http://localhost:8000/docs

Stop with `Ctrl+C`, or `docker compose down`. Add `-v` to also wipe the database.

## Tests

Tests run against a real Postgres (the app uses Postgres upserts and JSONB).

```bash
docker compose up -d db
docker compose exec db createdb -U personal_api personal_api_test

cd backend
python -m venv venv
venv/Scripts/pip install -r requirements-dev.txt                 # Windows
$env:TEST_DATABASE_URL="postgresql+psycopg2://personal_api:<your password>@localhost:5432/personal_api_test"
venv/Scripts/python -m pytest
```

## Database changes

Change a model in `backend/app/models/`, then:

```bash
docker compose exec backend alembic revision --autogenerate -m "what changed"
```

Review the file it creates in `backend/migrations/versions/`. It is applied on next startup.

## Project layout

```
backend/
  app/
    main.py            FastAPI app
    config.py          settings from environment
    database.py        SQLAlchemy engine and session
    security.py        API key check for writes
    schemas.py         response shapes
    models/            tables, one file per category
    routers/           endpoints
    services/          Apple Health import, Notion sync, read queries
  migrations/          Alembic migrations
  tests/
docker-compose.yml           base services (db, backend)
docker-compose.override.yml  local dev: ports, hot reload
```
