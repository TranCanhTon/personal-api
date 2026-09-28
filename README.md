# Personal API

A JSON API for my own life data. Apple Health (sleep, heart rate, workouts,
steps, calories in and out via Lifesum) and Notion (to do list, trading
journal, workout logs) flow into one Postgres database, served by FastAPI.

**Stack:** Python, FastAPI, PostgreSQL, Docker, AWS, Terraform, GitHub Actions, Ansible

## Categories

| Category | Data | Source |
|---|---|---|
| Fitness | Calories in and out, steps, heart rate, workouts, workout exercises | Apple Health, Notion |
| Sleep | Sleep stages and duration | Apple Health |
| To Do | To do list | Notion |
| Hobby | Trading journal | Notion |

## Run locally

Needs Docker Desktop.

```bash
cp .env.example .env        # then set your own password
docker compose up --build
```

- API: http://localhost:8000
- Health check: http://localhost:8000/health
- Interactive docs: http://localhost:8000/docs

Stop with `Ctrl+C`, or `docker compose down`. Add `-v` to also wipe the database.

## Tests

```bash
cd backend
python -m venv venv
venv/Scripts/pip install -r requirements-dev.txt   # Windows
venv/Scripts/python -m pytest
```

## Project layout

```
backend/
  app/
    main.py           FastAPI app
    config.py         settings from environment
    database.py       SQLAlchemy engine and session
    logging_config.py JSON logs
    routers/          endpoints
  tests/
docker-compose.yml           base services (db, backend)
docker-compose.override.yml  local dev: ports, hot reload
```
