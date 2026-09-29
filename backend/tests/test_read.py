from datetime import date, timedelta


def test_empty_day_has_full_shape(client):
    day = client.get("/days/2026-01-01").json()
    assert day["date"] == "2026-01-01"
    assert day["fitness"]["steps"] is None
    assert day["fitness"]["workouts"] == []
    assert day["sleep"] is None
    assert day["todo"] == {"tasks": [], "done": 0, "total": 0}
    assert day["hobby"]["trading"]["summary"]["win_rate"] is None


def test_default_range_is_last_7_days(client):
    days = client.get("/days").json()
    assert len(days) == 7
    assert days[-1]["date"] == date.today().isoformat()
    assert days[0]["date"] == (date.today() - timedelta(days=6)).isoformat()


def test_range_validation(client):
    assert client.get("/days", params={"start": "2026-02-01", "end": "2026-01-01"}).status_code == 422
    assert client.get("/days", params={"start": "2020-01-01", "end": "2026-01-01"}).status_code == 422
    assert client.get("/days/not-a-date").status_code == 422


def test_reads_are_public_and_writes_are_not(client):
    assert client.get("/fitness").status_code == 200
    assert client.get("/sleep").status_code == 200
    assert client.post("/ingest/health", json={}).status_code == 401


def test_todos_default_to_today(client):
    from app.routers.read import today

    days = client.get("/todos").json()
    assert [d["date"] for d in days] == [today().isoformat()]


def test_todos_single_day_and_range(client):
    one = client.get("/todos", params={"date": "2026-09-29"}).json()
    assert [d["date"] for d in one] == ["2026-09-29"]
    week = client.get("/todos", params={"start": "2026-09-22", "end": "2026-09-28"}).json()
    assert len(week) == 7


def test_todos_param_validation(client):
    assert client.get("/todos", params={"date": "2026-09-29", "start": "2026-09-29"}).status_code == 422
    assert client.get("/todos", params={"start": "2026-09-29"}).status_code == 422
    assert client.get("/todos", params={"start": "2026-09-29", "end": "2026-09-01"}).status_code == 422


def test_fitness_defaults_to_today(client):
    from app.routers.read import today

    assert [d["date"] for d in client.get("/fitness").json()] == [today().isoformat()]
    assert [d["date"] for d in client.get("/fitness", params={"date": "2026-09-28"}).json()] == ["2026-09-28"]
    assert len(client.get("/fitness", params={"start": "2026-09-22", "end": "2026-09-28"}).json()) == 7
