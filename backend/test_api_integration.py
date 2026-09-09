"""Integration tests for API endpoints.

Tests: /sensors, /decision, /advisory, /yard, /auth across all sections.
"""
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app

client = TestClient(app)

# Tokens for each controller
TOKENS: dict[str, str] = {}


def _login(controller_id: str, password: str) -> str:
    resp = client.post("/login", json={"controller_id": controller_id, "password": password})
    assert resp.status_code == 200
    return resp.json()["token"]


@pytest.fixture(autouse=True)
def setup_tokens():
    if not TOKENS:
        TOKENS["CCG-VR"] = _login("CCG-VR", "ccgvr123")
        TOKENS["VR-VLSD"] = _login("VR-VLSD", "vrvlsd123")
        TOKENS["VR-BL"] = _login("VR-BL", "vrbl123")


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# =============================================================================
# AUTH TESTS
# =============================================================================

class TestAuth:
    def test_login_valid_credentials(self):
        resp = client.post("/login", json={"controller_id": "CCG-VR", "password": "ccgvr123"})
        assert resp.status_code == 200
        assert "token" in resp.json()

    def test_login_invalid_password(self):
        resp = client.post("/login", json={"controller_id": "CCG-VR", "password": "wrong"})
        assert resp.status_code == 401

    def test_login_invalid_controller(self):
        resp = client.post("/login", json={"controller_id": "INVALID", "password": "123"})
        assert resp.status_code == 401

    def test_me_with_valid_token(self):
        resp = client.get("/me", headers=_auth(TOKENS["CCG-VR"]))
        assert resp.status_code == 200
        assert resp.json()["controller_id"] == "CCG-VR"

    def test_me_without_token(self):
        resp = client.get("/me")
        assert resp.status_code == 401


# =============================================================================
# SENSORS TESTS
# =============================================================================

class TestSensors:
    def test_sensors_section_a_st_a1(self):
        resp = client.get("/sensors?station=st_a1", headers=_auth(TOKENS["CCG-VR"]))
        assert resp.status_code == 200
        data = resp.json()
        assert data["station_id"] == "st_a1"
        assert "zones" in data
        assert "signals" in data
        assert "trains" in data

    def test_sensors_section_a_st_a2(self):
        resp = client.get("/sensors?station=st_a2", headers=_auth(TOKENS["CCG-VR"]))
        assert resp.status_code == 200
        assert resp.json()["station_id"] == "st_a2"

    def test_sensors_section_b_st_b1(self):
        resp = client.get("/sensors?station=st_b1", headers=_auth(TOKENS["VR-VLSD"]))
        assert resp.status_code == 200
        assert resp.json()["station_id"] == "st_b1"

    def test_sensors_section_b_st_b2(self):
        resp = client.get("/sensors?station=st_b2", headers=_auth(TOKENS["VR-VLSD"]))
        assert resp.status_code == 200

    def test_sensors_section_c_st_c1(self):
        resp = client.get("/sensors?station=st_c1", headers=_auth(TOKENS["VR-BL"]))
        assert resp.status_code == 200

    def test_sensors_section_c_st_c2(self):
        resp = client.get("/sensors?station=st_c2", headers=_auth(TOKENS["VR-BL"]))
        assert resp.status_code == 200

    def test_sensors_cross_section_forbidden(self):
        resp = client.get("/sensors?station=st_a1", headers=_auth(TOKENS["VR-BL"]))
        assert resp.status_code == 403

    def test_sensors_signals_have_valid_aspects(self):
        resp = client.get("/sensors?station=st_a1", headers=_auth(TOKENS["CCG-VR"]))
        valid = {"red", "green", "single_yellow", "double_yellow"}
        for sig, aspect in resp.json()["signals"].items():
            assert aspect in valid, f"{sig} has invalid aspect {aspect}"

    def test_sensors_zones_are_booleans(self):
        resp = client.get("/sensors?station=st_a1", headers=_auth(TOKENS["CCG-VR"]))
        for zone, val in resp.json()["zones"].items():
            assert isinstance(val, bool), f"{zone} is not boolean"

    def test_sensors_trains_have_required_fields(self):
        resp = client.get("/sensors?station=st_a1", headers=_auth(TOKENS["CCG-VR"]))
        for train in resp.json()["trains"]:
            assert "train_id" in train
            assert "block_id" in train
            assert "line_id" in train


# =============================================================================
# DECISION ENDPOINT TESTS
# =============================================================================

class TestDecisionEndpoint:
    def _make_decision(self, token, trains, context=None):
        if context is None:
            context = {
                "occupied_lines": [],
                "occupied_turnouts": [],
                "fouling_segments": [],
                "disaster_active": False,
            }
        return client.post(
            "/decision",
            json={"trains": trains, "context": context},
            headers=_auth(token),
        )

    def _train(self, **overrides):
        base = {
            "train_id": "T1",
            "train_type": "MAIL_EXPRESS",
            "block_id": "ST_A1_BC",
            "line_id": "UP_MAIN",
            "next_block_id": "ST_A1_CD",
            "signal_state": "GREEN",
            "max_speed": 100,
            "sectional_speed": 100,
            "scheduled_time": 0,
            "current_time": 0,
            "has_written_authority": False,
        }
        base.update(overrides)
        return base

    def test_decision_green_allows(self):
        resp = self._make_decision(TOKENS["CCG-VR"], [self._train()])
        assert resp.status_code == 200
        assert resp.json()["decisions"][0]["allow_movement"] is True

    def test_decision_red_holds(self):
        resp = self._make_decision(
            TOKENS["CCG-VR"], [self._train(signal_state="RED")]
        )
        assert resp.status_code == 200
        assert resp.json()["decisions"][0]["allow_movement"] is False

    def test_decision_written_authority(self):
        resp = self._make_decision(
            TOKENS["CCG-VR"],
            [self._train(signal_state="RED", has_written_authority=True)],
        )
        assert resp.status_code == 200
        assert resp.json()["decisions"][0]["allow_movement"] is True

    def test_decision_disaster_mode(self):
        resp = self._make_decision(
            TOKENS["CCG-VR"],
            [self._train()],
            context={
                "occupied_lines": [],
                "occupied_turnouts": [],
                "fouling_segments": [],
                "disaster_active": True,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["decisions"][0]["allow_movement"] is False

    def test_decision_unknown_train_type(self):
        resp = self._make_decision(
            TOKENS["CCG-VR"], [self._train(train_type="INVALID")]
        )
        assert resp.status_code == 422

    def test_decision_section_b(self):
        resp = self._make_decision(
            TOKENS["VR-VLSD"],
            [self._train(block_id="ST_B1_BC", line_id="UP_MAIN")],
        )
        assert resp.status_code == 200
        assert resp.json()["decisions"][0]["allow_movement"] is True

    def test_decision_section_c(self):
        resp = self._make_decision(
            TOKENS["VR-BL"],
            [self._train(block_id="ST_C1_BC", line_id="DN_MAIN")],
        )
        assert resp.status_code == 200

    def test_decision_cross_section_forbidden(self):
        resp = self._make_decision(
            TOKENS["VR-BL"],
            [self._train(block_id="ST_A1_BC", line_id="UP_MAIN")],
        )
        assert resp.status_code == 403

    def test_decision_multi_train(self):
        resp = self._make_decision(
            TOKENS["CCG-VR"],
            [
                self._train(train_id="T1", train_type="GOODS"),
                self._train(train_id="T2", train_type="VANDE_BHARAT"),
            ],
        )
        assert resp.status_code == 200
        assert len(resp.json()["decisions"]) == 2

    def test_decision_empty_trains(self):
        resp = self._make_decision(TOKENS["CCG-VR"], [])
        assert resp.status_code == 200
        assert resp.json()["decisions"] == []


# =============================================================================
# ADVISORY ENDPOINT TESTS
# =============================================================================

class TestAdvisoryEndpoint:
    def test_advisory_returns_list(self):
        resp = client.get("/advisory", headers=_auth(TOKENS["CCG-VR"]))
        assert resp.status_code == 200

    def test_advisory_has_section_context(self):
        resp = client.get("/advisory", headers=_auth(TOKENS["CCG-VR"]))
        data = resp.json()
        if data.get("advisories"):
            adv = data["advisories"][0]
            assert "section_id" in adv
            assert "section_name" in adv


# =============================================================================
# YARD ENDPOINT TESTS
# =============================================================================

class TestYardEndpoint:
    def test_yards_list(self):
        resp = client.get("/yards", headers=_auth(TOKENS["CCG-VR"]))
        assert resp.status_code == 200
        yards = resp.json()
        assert len(yards) == 6
        ids = {y["station_id"] for y in yards}
        assert "st_a1" in ids
        assert "st_c2" in ids

    def test_yard_layout_section_a(self):
        resp = client.get("/yard/st_a1", headers=_auth(TOKENS["CCG-VR"]))
        assert resp.status_code == 200
        data = resp.json()
        assert data["station_id"] == "st_a1"
        assert "lines" in data
        assert "signals" in data

    def test_yard_layout_cross_section_forbidden(self):
        resp = client.get("/yard/st_a1", headers=_auth(TOKENS["VR-BL"]))
        assert resp.status_code == 403

    def test_yard_layout_not_found(self):
        resp = client.get("/yard/st_nonexistent", headers=_auth(TOKENS["CCG-VR"]))
        assert resp.status_code == 404

    def test_sections_endpoint(self):
        resp = client.get("/sections", headers=_auth(TOKENS["CCG-VR"]))
        assert resp.status_code == 200
        data = resp.json()
        assert "line_order" in data
        assert len(data["line_order"]) == 6


# =============================================================================
# HEALTH ENDPOINT
# =============================================================================

class TestHealth:
    def test_health_check(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "RailSahayak API running"
