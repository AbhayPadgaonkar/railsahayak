from backend.services.crisis_state import (
    crisis_types,
    declare_crisis,
    disaster_active,
    list_crises,
    resolve_crisis,
)


def test_crisis_types_include_disaster_classes():
    types = {t["type"]: t for t in crisis_types()}
    assert "NATURAL_DISASTER" in types
    assert types["NATURAL_DISASTER"]["is_disaster"] is True
    assert "SIGNAL_FAILURE" in types
    assert types["SIGNAL_FAILURE"]["is_disaster"] is False


def test_declare_unknown_type_raises():
    import pytest

    with pytest.raises(ValueError):
        declare_crisis("NOT_A_TYPE", None, "st_a1", None, None)


def test_declare_and_resolve_cycle():
    crisis = declare_crisis(
        "SIGNAL_FAILURE",
        "HIGH",
        "st_b1",
        block_id=None,
        description="Test signal failure",
    )
    assert crisis["status"] == "ACTIVE"
    assert crisis["severity"] == "HIGH"

    resolved = resolve_crisis(crisis["id"])
    assert resolved is not None
    assert resolved["status"] == "RESOLVED"
    assert resolved["resolved_at"] is not None


def test_disaster_flag_active_while_disaster_crisis_live():
    crisis = declare_crisis("DERAILMENT", "CRITICAL", "st_c1", None, None)
    assert disaster_active() is True
    resolve_crisis(crisis["id"])
    assert disaster_active() is False


def test_disaster_flag_agnostic_to_normal_crisis():
    crisis = declare_crisis("TRACK_OBSTRUCTION", "HIGH", "st_a1", None, None)
    assert disaster_active() is False
    resolve_crisis(crisis["id"])


def test_list_crises_newest_first():
    c1 = declare_crisis("SIGNAL_FAILURE", "MEDIUM", "st_a1", None, None)
    c2 = declare_crisis("SIGNAL_FAILURE", "LOW", "st_a2", None, None)
    crises = list_crises()
    assert crises[0]["id"] == c2["id"]
    resolve_crisis(c1["id"])
    resolve_crisis(c2["id"])


def test_resolve_unknown_returns_none():
    assert resolve_crisis("no-such-crisis") is None