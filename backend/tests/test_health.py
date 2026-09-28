from app.database import get_db
from app.main import app


class FakeSession:
    def __init__(self, fail: bool = False):
        self.fail = fail

    def execute(self, *args, **kwargs):
        if self.fail:
            raise RuntimeError("db down")


def test_health_ok(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "up"}


def test_health_db_down(client):
    app.dependency_overrides[get_db] = lambda: FakeSession(fail=True)
    try:
        res = client.get("/health")
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 503
    assert res.json()["database"] == "down"
