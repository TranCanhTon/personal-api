import hashlib
import hmac
import json

import pytest

from app.services import notion_runner
from app.services.notion_sync import date_from_title
from app.routers import webhooks
from tests.conftest import AUTH


# ---------- fake Notion ----------

def todo_page(page_id, title, done):
    return {
        "id": page_id,
        "properties": {
            "Task name": {"type": "title", "title": [{"plain_text": title}]},
            "Done": {"type": "checkbox", "checkbox": done},
        },
    }


def trade_page(page_id, day, result, rr, rules="Yes"):
    return {
        "id": page_id,
        "properties": {
            "Entry": {"type": "title", "title": [{"plain_text": f"Day {page_id}"}]},
            "Date": {"type": "date", "date": {"start": day}},
            "PnL": {"type": "select", "select": {"name": result}},
            "Actual RR": {"type": "number", "number": rr},
            "Intended RR": {"type": "number", "number": 2},
            "Trade quality": {"type": "select", "select": {"name": "High"}},
            "Did you follow your rules?": {"type": "select", "select": {"name": rules}},
            "Bias correct?": {"type": "select", "select": {"name": "Yes"}},
            "Time of entry": {"type": "rich_text", "rich_text": [{"plain_text": "16:45"}]},
            "Emotion": {"type": "rich_text", "rich_text": [{"plain_text": "Calm"}]},
            "Execution": {"type": "rich_text", "rich_text": []},
            "Note": {"type": "rich_text", "rich_text": [{"plain_text": "Swept the low"}]},
        },
    }


class FakeNotion:
    def __init__(self, token=None):
        self.databases = [
            {"id": "db-27", "title": "27.09.2026"},
            {"id": "db-26", "title": "26/09/2026 - YOU HAVE TO LOCK IN"},
            {"id": "db-notes", "title": "Random notes"},
        ]
        self.rows = {
            "db-27": [todo_page("t1", "830am: Gym", True), todo_page("t2", "Apply to jobs", False)],
            "db-26": [todo_page("t3", "Backtest", True)],
            "trades-db": [
                trade_page("r1", "2026-09-26", "Profit", 2.5),
                trade_page("r2", "2026-09-27", "Loss", -1, rules="No"),
                trade_page("r3", "2026-09-27", "No trade", None),
            ],
        }

    def child_databases(self, page_id):
        return self.databases

    def query_database(self, database_id):
        return self.rows[database_id]

    def close(self):
        pass


@pytest.fixture
def fake_notion(monkeypatch):
    fake = FakeNotion()
    monkeypatch.setattr(notion_runner, "NotionClient", lambda token: fake)
    monkeypatch.setattr(notion_runner.settings, "notion_trades_database_id", "trades-db")
    monkeypatch.setattr(notion_runner.settings, "notion_sync_trades", True)
    return fake


# ---------- tests ----------

@pytest.mark.parametrize("title, expected", [
    ("28.09.2026", "2026-09-28"),
    ("11/09/2026 - YOU HAVE TO LOCK IN", "2026-09-11"),
    ("1-2-2026", "2026-02-01"),
    ("Random notes", None),
    ("31.02.2026", None),
])
def test_date_from_title(title, expected):
    result = date_from_title(title)
    assert (result.isoformat() if result else None) == expected


def test_trades_are_skipped_by_default(client, fake_notion, monkeypatch):
    monkeypatch.setattr(notion_runner.settings, "notion_sync_trades", False)
    body = client.post("/ingest/notion/sync", headers=AUTH).json()
    assert body["todos"] == 3
    assert body["trades"] == 0


def test_sync_requires_key(client, fake_notion):
    assert client.post("/ingest/notion/sync").status_code == 401


def test_sync_imports_todos_and_trades(client, fake_notion):
    res = client.post("/ingest/notion/sync", headers=AUTH)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["todo_days"] == 2
    assert body["todos"] == 3
    assert body["trades"] == 3
    assert body["skipped_databases"] == ["Random notes"]

    todos = client.get("/todos", params={"start": "2026-09-26", "end": "2026-09-27"}).json()
    by_day = {d["date"]: d for d in todos}
    assert by_day["2026-09-27"]["done"] == 1
    assert by_day["2026-09-27"]["total"] == 2
    assert by_day["2026-09-26"]["tasks"] == [{"title": "Backtest", "done": True}]

    trading = client.get("/trades", params={"start": "2026-09-26", "end": "2026-09-27"}).json()
    summary = trading["summary"]
    assert summary == {"wins": 1, "losses": 1, "breakeven": 0, "win_rate": 50.0}
    first = trading["trades"][0]
    assert first["followed_rules"] is True
    assert first["time_of_entry"] == "16:45"
    assert first["note"] == "Swept the low"


def test_trades_default_to_all_time(client, fake_notion):
    fake_notion.rows["trades-db"] += [
        trade_page("r4", "2025-01-10", "Profit", 3),
        trade_page("r5", "2025-01-11", "Profit", 2),
        trade_page("r6", "2025-01-12", "BE", 0),
    ]
    client.post("/ingest/notion/sync", headers=AUTH)

    summary = client.get("/trades").json()["summary"]
    # 3 wins, 1 loss. Breakeven and no trade days do not count toward win rate
    assert summary == {"wins": 3, "losses": 1, "breakeven": 1, "win_rate": 75.0}


def test_win_rate_is_empty_without_trades(client):
    assert client.get("/trades").json()["summary"]["win_rate"] is None


def test_sync_removes_deleted_pages(client, fake_notion):
    client.post("/ingest/notion/sync", headers=AUTH)
    fake_notion.rows["db-27"] = [todo_page("t1", "830am: Gym", True)]
    fake_notion.rows["trades-db"] = fake_notion.rows["trades-db"][:1]

    body = client.post("/ingest/notion/sync", headers=AUTH).json()
    assert body["todos_deleted"] == 1
    assert body["trades_deleted"] == 2
    assert client.get("/days/2026-09-27").json()["todo"]["total"] == 1


def test_sync_status_shows_latest_run(client, fake_notion):
    client.post("/ingest/notion/sync", headers=AUTH)
    status = {s["source"]: s for s in client.get("/sync/status").json()}
    assert status["notion"]["status"] == "ok"
    assert status["notion"]["records"] == 3
    assert status["notion_trades"]["status"] == "ok"
    assert status["notion_trades"]["records"] == 3


def test_trades_still_sync_when_todos_fail(client, fake_notion):
    def broken_page(page_id):
        raise RuntimeError("Notion 500 on the to do page")

    fake_notion.child_databases = broken_page
    res = client.post("/ingest/notion/sync", headers=AUTH)
    assert res.status_code == 502

    status = {s["source"]: s for s in client.get("/sync/status").json()}
    assert status["notion"]["status"] == "error"
    assert "Notion 500" in status["notion"]["error"]
    assert status["notion_trades"]["status"] == "ok"
    assert len(client.get("/trades").json()["trades"]) == 3


# ---------- webhook ----------

def sign(body: bytes) -> str:
    return "sha256=" + hmac.new(b"test-webhook-secret", body, hashlib.sha256).hexdigest()


@pytest.fixture
def background_calls(monkeypatch):
    calls = []
    monkeypatch.setattr(webhooks, "run_notion_sync_in_background", lambda: calls.append(1))
    return calls


def test_webhook_verification_token(client, background_calls):
    res = client.post("/webhooks/notion", json={"verification_token": "secret_abc"})
    assert res.status_code == 200
    assert background_calls == []


def test_webhook_rejects_bad_signature(client, background_calls):
    body = json.dumps({"type": "page.created"}).encode()
    res = client.post("/webhooks/notion", content=body, headers={"X-Notion-Signature": "sha256=wrong"})
    assert res.status_code == 401
    assert background_calls == []


def test_webhook_valid_event_triggers_sync(client, background_calls):
    body = json.dumps({"type": "page.properties_updated"}).encode()
    res = client.post("/webhooks/notion", content=body, headers={"X-Notion-Signature": sign(body)})
    assert res.status_code == 200
    assert background_calls == [1]
