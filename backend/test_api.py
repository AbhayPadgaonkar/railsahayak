import pytest
from fastapi.testclient import TestClient

from backend.api.main import app

client = TestClient(app)

VALID_BLOCK = "ST_A1_AB"
VALID_LINE = "PROTO_LINE"


def _token_for(controller_id: str, password: str) -> str:
    resp = client.post(
        "/login",
        json={"controller_id": controller_id, "password": password},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


def _login() -> str:
    return _token_for("CCG-VR", "ccgvr123")


@pytest.fixture
def auth_headers() -> dict:
    return {"Authorization": f"Bearer {_login()}"}


@pytest.fixture
def other_auth_headers() -> dict:
    return {"Authorization": f"Bearer {_token_for('VR-VLSD', 'vrvlsd123')}"}


def _decision_body(train_id="UP-T", signal="GREEN"):
    train = {
        "train_id": train_id,
        "train_type": "MAIL_EXPRESS",
        "block_id": VALID_BLOCK,
        "line_id": VALID_LINE,
        "next_block_id": "ST_A1_BC",
        "signal_state": signal,
        "sectional_speed": 100,
        "scheduled_time": 1000,
        "current_time": 1000,
        "gradient": None,
        "condition": None,
        "has_written_authority": False,
    }
    return {
        "trains": [train],
        "context": {
            "occupied_lines": [],
            "occupied_turnouts": [],
            "fouling_segments": [],
            "disaster_active": False,
        },
    }


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert "running" in resp.json()["status"]


def test_decision_endpoint_allows(auth_headers):
    resp = client.post("/decision", json=_decision_body(), headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["decisions"][0]["allow_movement"] is True


def test_decision_endpoint_holds_on_red(auth_headers):
    resp = client.post("/decision", json=_decision_body(signal="RED"), headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["decisions"][0]["allow_movement"] is False


def test_sections_endpoint():
    resp = client.get("/sections")
    assert resp.status_code == 200
    body = resp.json()
    assert body["line_id"] == "PROTO_LINE"
    assert len(body["sections"]) == 3


def test_yards_endpoint():
    resp = client.get("/yards")
    assert resp.status_code == 200
    stations = [y["station_id"] for y in resp.json()]
    assert {"st_a1", "st_a2", "st_b1", "st_b2", "st_c1", "st_c2"}.issubset(stations)
    assert "demo_yard" in stations


def test_auditlogs_endpoint():
    resp = client.get("/auditlogs?limit=5")
    assert resp.status_code == 200
    assert "logs" in resp.json()


def test_crisis_flow():
    declare = client.post(
        "/crisis",
        json={
            "crisis_type": "SIGNAL_FAILURE",
            "severity": "HIGH",
            "location": "st_a1",
            "description": "test crisis",
        },
    )
    assert declare.status_code == 200
    crisis_id = declare.json()["crisis"]["id"]
    assert declare.json()["crisis"]["status"] == "ACTIVE"

    state = client.get("/crisis")
    assert state.status_code == 200
    assert any(c["id"] == crisis_id for c in state.json()["crises"])

    resolve = client.post("/crisis/resolve", json={"crisis_id": crisis_id})
    assert resolve.status_code == 200
    assert resolve.json()["crisis"]["status"] == "RESOLVED"


def test_whatif_run_endpoint():
    resp = client.post(
        "/whatif/run",
        json={
            "train_id": "UP-W",
            "train_type": "MAIL_EXPRESS",
            "block_id": VALID_BLOCK,
            "line_id": VALID_LINE,
            "sectional_speed": 100,
            "scenario_type": "FOG",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["movement"]["scenario"]["max_speed"] == 60


def test_whatif_unknown_scenario_is_422():
    resp = client.post(
        "/whatif/run",
        json={
            "train_id": "UP-W",
            "train_type": "MAIL_EXPRESS",
            "block_id": VALID_BLOCK,
            "line_id": VALID_LINE,
            "sectional_speed": 100,
            "scenario_type": "NOPE",
        },
    )
    assert resp.status_code == 422


def test_decision_endpoint_requires_auth():
    resp = client.post("/decision", json=_decision_body())
    assert resp.status_code == 401


def test_decision_endpoint_denies_foreign_block(auth_headers):
    body = _decision_body()
    body["trains"][0]["block_id"] = "ST_B1_AB"
    resp = client.post("/decision", json=body, headers=auth_headers)
    assert resp.status_code == 403


def test_sensors_requires_auth():
    resp = client.get("/sensors")
    assert resp.status_code == 401


def test_sensors_allows_own_station(auth_headers):
    resp = client.get("/sensors?station=st_a1", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["station_id"] == "st_a1"


def test_sensors_denies_other_station(auth_headers):
    resp = client.get("/sensors?station=st_b1", headers=auth_headers)
    assert resp.status_code == 403


def test_yard_requires_auth():
    resp = client.get("/yard/st_a1")
    assert resp.status_code == 401


def test_yard_allows_own_station(auth_headers):
    resp = client.get("/yard/st_a1", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["station_id"] == "st_a1"


def test_yard_denies_other_station(auth_headers):
    resp = client.get("/yard/st_b1", headers=auth_headers)
    assert resp.status_code == 403


def test_advisory_requires_auth():
    resp = client.get("/advisory")
    assert resp.status_code == 401


def test_login_and_me_round_trip():
    token = _login()
    resp = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["controller_id"] == "CCG-VR"
    assert body["section"] == "CCG-VR"


def test_assistant_endpoint():
    resp = client.post("/assistant", json={"message": "sections"})
    assert resp.status_code == 200
    assert "Section" in resp.json()["answer"]
