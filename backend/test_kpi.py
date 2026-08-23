from fastapi.testclient import TestClient

from backend.api.main import app

client = TestClient(app)


def test_get_kpis_returns_history():
    response = client.get("/kpis")
    assert response.status_code == 200
    data = response.json()
    assert "history" in data
    assert len(data["history"]) >= 1

    snapshot = data["history"][-1]
    assert "ts" in snapshot
    assert "active_trains" in snapshot
    assert "block_utilization_pct" in snapshot
    assert "average_delay_min" in snapshot
    assert "punctuality_pct" in snapshot
    assert "throughput_trains_per_hour" in snapshot
    assert "HIGH" in snapshot["advisories"]
    assert "MEDIUM" in snapshot["advisories"]
    assert "LOW" in snapshot["advisories"]
    assert "accept" in snapshot["actions"]
    assert "dismiss" in snapshot["actions"]
    assert "total" in snapshot["actions"]
    assert isinstance(snapshot["actions"]["total"], int)


def test_kpis_history_grows_on_requests():
    response1 = client.get("/kpis")
    count1 = len(response1.json()["history"])
    response2 = client.get("/kpis")
    count2 = len(response2.json()["history"])
    assert count2 == count1 + 1
