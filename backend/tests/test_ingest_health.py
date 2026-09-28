import copy

from sqlalchemy import func, select

from app.models import RawPayload, SyncLog, Workout
from tests.conftest import AUTH

PAYLOAD = {
    "data": {
        "metrics": [
            {"name": "step_count", "units": "count", "data": [
                {"qty": 8000, "date": "2026-09-27 00:00:00 +0300"},
                {"qty": 3200, "date": "2026-09-27 00:00:00 +0300"},
            ]},
            {"name": "active_energy", "units": "kJ", "data": [
                {"qty": 4184, "date": "2026-09-27 00:00:00 +0300"},
            ]},
            {"name": "basal_energy_burned", "units": "kcal", "data": [
                {"qty": 1800, "date": "2026-09-27 00:00:00 +0300"},
            ]},
            {"name": "dietary_energy", "units": "kcal", "data": [
                {"qty": 2450, "date": "2026-09-27 00:00:00 +0300"},
            ]},
            {"name": "protein", "units": "g", "data": [{"qty": 180, "date": "2026-09-27 00:00:00 +0300"}]},
            {"name": "carbohydrates", "units": "g", "data": [{"qty": 250, "date": "2026-09-27 00:00:00 +0300"}]},
            {"name": "total_fat", "units": "g", "data": [{"qty": 70, "date": "2026-09-27 00:00:00 +0300"}]},
            {"name": "heart_rate", "units": "bpm", "data": [
                {"date": "2026-09-27 00:00:00 +0300", "Min": 50, "Avg": 70, "Max": 150},
                {"date": "2026-09-27 12:00:00 +0300", "Min": 55, "Avg": 74, "Max": 165},
            ]},
            {"name": "resting_heart_rate", "units": "bpm", "data": [
                {"qty": 58, "date": "2026-09-27 00:00:00 +0300"},
            ]},
            {"name": "sleep_analysis", "units": "hr", "data": [
                {
                    "date": "2026-09-27",
                    "totalSleep": 7.5, "asleep": 7.5, "core": 4.0, "deep": 1.5, "rem": 2.0, "awake": 0.25,
                    "sleepStart": "2026-09-27 00:30:00 +0300", "sleepEnd": "2026-09-27 08:15:00 +0300",
                },
                {"value": "Core", "sleepStart": "2026-09-27 01:00:00 +0300"},
            ]},
            {"name": "blood_oxygen_saturation", "units": "%", "data": [
                {"qty": 98, "date": "2026-09-27 00:00:00 +0300"},
            ]},
        ],
        "workouts": [
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Traditional Strength Training",
                "start": "2026-09-27 18:00:00 +0300",
                "end": "2026-09-27 19:05:00 +0300",
                "duration": 3900,
                "activeEnergyBurned": {"qty": 420, "units": "kcal"},
                "avgHeartRate": {"qty": 128, "units": "bpm"},
                "maxHeartRate": {"qty": 162, "units": "bpm"},
            }
        ],
    }
}


def test_rejects_missing_key(client):
    assert client.post("/ingest/health", json=PAYLOAD).status_code == 401


def test_rejects_wrong_key(client):
    res = client.post("/ingest/health", json=PAYLOAD, headers={"X-API-Key": "nope"})
    assert res.status_code == 401


def test_imports_everything(client, db):
    res = client.post("/ingest/health", json=PAYLOAD, headers=AUTH)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["days_fitness"] == 1
    assert body["days_heart_rate"] == 1
    assert body["nights_sleep"] == 1
    assert body["workouts"] == 1
    assert body["skipped_sleep_entries"] == 1
    assert body["ignored_metrics"] == ["blood_oxygen_saturation"]

    day = client.get("/days/2026-09-27").json()
    fit = day["fitness"]
    assert fit["steps"] == 11200
    assert fit["active_calories"] == 1000  # 4184 kJ converted to kcal
    assert fit["calories_out"] == 2800
    assert fit["calories_in"] == 2450
    assert fit["macros"] == {"protein_g": 180, "carbs_g": 250, "fat_g": 70}
    assert fit["heart_rate"] == {"resting": 58, "avg": 72, "min": 50, "max": 165}

    workout = fit["workouts"][0]
    assert workout["type"] == "Traditional Strength Training"
    assert workout["duration_min"] == 65
    assert workout["calories"] == 420
    assert workout["avg_heart_rate"] == 128

    sleep = day["sleep"]
    assert sleep["total_min"] == 450
    assert sleep["deep_min"] == 90
    assert sleep["awake_min"] == 15

    assert db.scalar(select(func.count()).select_from(RawPayload)) == 1
    log = db.scalar(select(SyncLog))
    assert log.status == "ok"
    assert log.records == 4


def test_sending_twice_does_not_duplicate(client, db):
    client.post("/ingest/health", json=PAYLOAD, headers=AUTH)
    client.post("/ingest/health", json=PAYLOAD, headers=AUTH)

    assert db.scalar(select(func.count()).select_from(Workout)) == 1
    assert client.get("/days/2026-09-27").json()["fitness"]["steps"] == 11200


def test_partial_update_keeps_other_fields(client):
    client.post("/ingest/health", json=PAYLOAD, headers=AUTH)
    only_steps = {"data": {"metrics": [
        {"name": "step_count", "units": "count", "data": [{"qty": 15000, "date": "2026-09-27 00:00:00 +0300"}]},
    ]}}
    client.post("/ingest/health", json=only_steps, headers=AUTH)

    fit = client.get("/days/2026-09-27").json()["fitness"]
    assert fit["steps"] == 15000
    assert fit["calories_in"] == 2450


def test_bad_payload_is_logged_and_raw_kept(client, db):
    broken = copy.deepcopy(PAYLOAD)
    del broken["data"]["workouts"][0]["start"]

    res = client.post("/ingest/health", json=broken, headers=AUTH)
    assert res.status_code == 422

    assert db.scalar(select(func.count()).select_from(RawPayload)) == 1
    log = db.scalar(select(SyncLog))
    assert log.status == "error"
    assert "KeyError" in log.error
    # Nothing half imported
    assert client.get("/days/2026-09-27").json()["fitness"]["steps"] is None
