from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app


class FakeSession:
    def __init__(self, fail: bool = False):
        self.fail = fail

    def execute(self, *args, **kwargs):
        if self.fail:
            raise RuntimeError("db down")


def _client(fail: bool) -> TestClient:
    app.dependency_overrides[get_db] = lambda: FakeSession(fail)
    return TestClient(app)


def test_health_ok():
    res = _client(fail=False).get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "up"}


def test_health_db_down():
    res = _client(fail=True).get("/health")
    assert res.status_code == 503
    assert res.json()["database"] == "down"
