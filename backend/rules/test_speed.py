from types import SimpleNamespace

from backend.rules.speed import determine_speed_limit


def test_clear_condition_keeps_sectional_speed():
    result = determine_speed_limit(sectional_speed=100, condition=None)
    assert result["max_speed"] == 100


def test_fog_caps_at_60():
    result = determine_speed_limit(sectional_speed=100, condition="FOG")
    assert result["max_speed"] == 60


def test_storm_caps_at_40():
    result = determine_speed_limit(sectional_speed=100, condition="STORM")
    assert result["max_speed"] == 40


def test_caution_signal_caps_at_30():
    result = determine_speed_limit(sectional_speed=100, signal_mode="CAUTION")
    assert result["max_speed"] == 30


def test_steep_up_gradient_restricts():
    result = determine_speed_limit(
        sectional_speed=100,
        gradient=SimpleNamespace(value=150, direction="UP"),
    )
    assert result["max_speed"] == 40


def test_steep_down_gradient_restricts_harder():
    result = determine_speed_limit(
        sectional_speed=100,
        gradient=SimpleNamespace(value=80, direction="DOWN"),
    )
    assert result["max_speed"] == 25


def test_low_speed_never_raised():
    result = determine_speed_limit(sectional_speed=20, condition=None)
    assert result["max_speed"] == 20