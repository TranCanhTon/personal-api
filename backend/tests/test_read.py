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
