from fastapi.testclient import TestClient

from solver.api import app


def test_health_reports_working_cp_sat() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["cp_sat"] is True
