from fastapi.testclient import TestClient

from backend.api.main import app

client = TestClient(app)


def test_get_rtis_feed():
    response = client.get("/rtis")
    assert response.status_code == 200
    data = response.json()
    assert "elapsed_seconds" in data
    assert "finished" in data
    assert "feeds" in data


def test_restart_rtis_replay():
    response = client.post("/rtis/start")
    assert response.status_code == 200
    assert response.json()["status"] == "started"
