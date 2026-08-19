from backend.rules.emergency import emergency_mode_decision


def test_normal_mode_allows_optimization():
    result = emergency_mode_decision(disaster_active=False)
    assert result["optimization_allowed"] is True
    assert "HOLD" in result["allowed_actions"]
    assert "PROCEED" in result["allowed_actions"]


def test_disaster_mode_disables_optimization():
    result = emergency_mode_decision(disaster_active=True)
    assert result["optimization_allowed"] is False
    assert result["allowed_actions"] == ["HOLD"]


def test_disaster_reason_safety_first():
    result = emergency_mode_decision(disaster_active=True)
    assert "safety" in result["reason"].lower()