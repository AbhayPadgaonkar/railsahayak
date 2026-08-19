from backend.services.whatif_service import run_scenario, scenario_options


def test_scenario_catalog_has_expected_presets():
    ids = {s["id"] for s in scenario_options()}
    assert {"FOG", "STORM", "SPEED_RESTRICTION", "GRADIENT", "HOLD"}.issubset(ids)


def test_fog_reduces_speed_verdict():
    result = run_scenario(
        train_id="T1",
        train_type="MAIL_EXPRESS",
        block_id="ST_A1_AB",
        line_id="PROTO_LINE",
        sectional_speed=100,
        scenario_type="FOG",
    )
    assert result["movement"]["scenario"]["max_speed"] == 60
    assert result["movement"]["baseline"]["max_speed"] == 100


def test_speed_restriction_caps_and_adds_transit_impact():
    result = run_scenario(
        train_id="T1",
        train_type="MAIL_EXPRESS",
        block_id="ST_A1_AB",
        line_id="PROTO_LINE",
        sectional_speed=100,
        scenario_type="SPEED_RESTRICTION",
        parameter=30,
    )
    assert result["movement"]["scenario"]["max_speed"] == 30
    assert result["transit_impact_min"] > 0


def test_storm_caps_at_40():
    result = run_scenario(
        train_id="T1",
        train_type="MAIL_EXPRESS",
        block_id="ST_A1_AB",
        line_id="PROTO_LINE",
        sectional_speed=100,
        scenario_type="STORM",
    )
    assert result["movement"]["scenario"]["max_speed"] == 40


def test_gradient_applies_restriction():
    result = run_scenario(
        train_id="T1",
        train_type="GOODS",
        block_id="ST_A1_AB",
        line_id="PROTO_LINE",
        sectional_speed=60,
        scenario_type="GRADIENT",
        parameter=150,
        direction="UP",
    )
    assert result["movement"]["scenario"]["max_speed"] == 40


def test_hold_blocks_movement():
    result = run_scenario(
        train_id="T1",
        train_type="MAIL_EXPRESS",
        block_id="ST_A1_AB",
        line_id="PROTO_LINE",
        sectional_speed=100,
        scenario_type="HOLD",
        parameter=15,
    )
    assert result["outcome"] == "HOLD"
    assert result["movement"]["scenario"]["allowed"] is False
    assert result["predicted_delay"]["scenario_min"] >= result["predicted_delay"]["baseline_min"]