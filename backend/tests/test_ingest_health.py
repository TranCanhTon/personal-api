import copy
from datetime import datetime, timedelta, timezone

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
    # 150 and 165 fall outside 18:00 to 19:05, so there is no min from samples
    assert workout["heart_rate"] == {"min": None, "avg": 128, "max": 162}

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


def _low_high(heart_rate):
    return heart_rate["min"], heart_rate["max"]


def _sleep_night(hr_entries):
    return {"data": {"metrics": [
        {"name": "heart_rate", "units": "bpm", "data": hr_entries},
        {"name": "sleep_analysis", "units": "hr", "data": [{
            "date": "2026-09-29", "totalSleep": 7.0, "deep": 1.0, "rem": 1.5, "core": 4.5, "awake": 0.2,
            "sleepStart": "2026-09-28 23:30:00 +0300", "sleepEnd": "2026-09-29 07:00:00 +0300",
        }]},
    ]}}


def test_sleep_heart_rate_uses_only_the_sleep_window(client):
    payload = _sleep_night([
        {"date": "2026-09-28 22:10:00 +0300", "Min": 70, "Avg": 80, "Max": 120},  # before bed
        {"date": "2026-09-28 23:45:00 +0300", "Min": 58, "Avg": 60, "Max": 66},
        {"date": "2026-09-29 03:20:00 +0300", "Min": 47, "Avg": 49, "Max": 52},
        {"date": "2026-09-29 06:40:00 +0300", "Min": 55, "Avg": 62, "Max": 71},
        {"date": "2026-09-29 08:30:00 +0300", "Min": 90, "Avg": 110, "Max": 140},  # after waking
    ])
    res = client.post("/ingest/health", json=payload, headers=AUTH)
    assert res.status_code == 200, res.text
    assert res.json()["heart_rate_samples"] == 5

    sleep = client.get("/days/2026-09-29").json()["sleep"]
    assert _low_high(sleep["heart_rate"]) == (47, 71)
    assert _low_high(client.get("/sleep", params={"date": "2026-09-29"}).json()[0]["heart_rate"]) == (47, 71)


def test_sleep_heart_rate_per_half_hour(client):
    payload = _sleep_night([
        {"date": "2026-09-28 22:10:00 +0300", "Min": 70, "Avg": 80, "Max": 120},  # before bed
        {"date": "2026-09-28 23:35:00 +0300", "Min": 58, "Avg": 60, "Max": 66},
        {"date": "2026-09-28 23:50:00 +0300", "Min": 55, "Avg": 58, "Max": 62},  # same half hour as 23:35
        {"date": "2026-09-29 03:20:00 +0300", "Min": 47, "Avg": 49, "Max": 52},
        {"date": "2026-09-29 06:40:00 +0300", "Min": 55, "Avg": 62, "Max": 71},
        {"date": "2026-09-29 08:30:00 +0300", "Min": 90, "Avg": 110, "Max": 140},  # after waking
    ])
    client.post("/ingest/health", json=payload, headers=AUTH)

    intervals = client.get("/days/2026-09-29").json()["sleep"]["heart_rate"]["intervals"]
    tz = timezone(timedelta(hours=3))
    assert [datetime.fromisoformat(i["start"]) for i in intervals] == [
        datetime(2026, 9, 28, 23, 30, tzinfo=tz),
        datetime(2026, 9, 29, 3, 0, tzinfo=tz),
        datetime(2026, 9, 29, 6, 30, tzinfo=tz),
    ]
    assert [(i["min"], i["max"]) for i in intervals] == [(55, 66), (47, 52), (55, 71)]


def test_sleep_heart_rate_works_when_sent_separately(client):
    night = _sleep_night([])
    client.post("/ingest/health", json=night, headers=AUTH)
    assert client.get("/days/2026-09-29").json()["sleep"]["heart_rate"] is None

    hr_only = {"data": {"metrics": [{"name": "heart_rate", "units": "bpm", "data": [
        {"date": "2026-09-29 02:00:00 +0300", "Min": 50, "Avg": 52, "Max": 55},
        {"date": "2026-09-29 04:00:00 +0300", "Min": 48, "Avg": 51, "Max": 60},
    ]}]}}
    client.post("/ingest/health", json=hr_only, headers=AUTH)
    assert _low_high(client.get("/days/2026-09-29").json()["sleep"]["heart_rate"]) == (48, 60)


def test_day_aggregated_heart_rate_is_not_used_for_sleep(client):
    payload = _sleep_night([{"date": "2026-09-29 00:00:00 +0300", "Min": 45, "Avg": 70, "Max": 170}])
    body = client.post("/ingest/health", json=payload, headers=AUTH).json()
    assert body["heart_rate_samples"] == 0
    day = client.get("/days/2026-09-29").json()
    assert day["sleep"]["heart_rate"] is None
    assert day["fitness"]["heart_rate"]["max"] == 170


def test_workout_heart_rate_min_comes_from_samples_inside_the_workout(client):
    payload = {"data": {
        "metrics": [{"name": "heart_rate", "units": "bpm", "data": [
            {"date": "2026-09-30 17:50:00 +0300", "Min": 60, "Avg": 65, "Max": 70},  # before
            {"date": "2026-09-30 18:05:00 +0300", "Min": 92, "Avg": 110, "Max": 130},
            {"date": "2026-09-30 18:40:00 +0300", "Min": 84, "Avg": 120, "Max": 158},
            {"date": "2026-09-30 19:20:00 +0300", "Min": 70, "Avg": 75, "Max": 80},  # after
        ]}],
        "workouts": [{
            "id": "w-1", "name": "Traditional Strength Training",
            "start": "2026-09-30 18:00:00 +0300", "end": "2026-09-30 19:00:00 +0300", "duration": 3600,
            "avgHeartRate": {"qty": 118, "units": "bpm"}, "maxHeartRate": {"qty": 158, "units": "bpm"},
        }],
    }}
    assert client.post("/ingest/health", json=payload, headers=AUTH).status_code == 200
    workout = client.get("/days/2026-09-30").json()["fitness"]["workouts"][0]
    assert workout["heart_rate"] == {"min": 84, "avg": 118, "max": 158}


def test_workout_without_any_heart_rate(client):
    payload = {"data": {"workouts": [{
        "id": "w-2", "name": "Walking",
        "start": "2026-09-30 10:00:00 +0300", "end": "2026-09-30 10:30:00 +0300", "duration": 1800,
    }]}}
    client.post("/ingest/health", json=payload, headers=AUTH)
    assert client.get("/days/2026-09-30").json()["fitness"]["workouts"][0]["heart_rate"] is None
