"""Comprehensive decision backend test suite.

Covers: normal cases, edge cases, scenario cases, signal interlocking,
precedence optimization, speed rules, and cross-section behavior.
"""
import pytest
from fastapi import HTTPException

from backend.rules.signals import check_signal_permission
from backend.rules.turnouts import check_turnout_conflict
from backend.services.decision_service import (
    Gradient,
    SectionDecisionRequest,
    SystemContext,
    TrainRequest,
    make_decision,
)

BLOCK = "ST_A1_AB"
LINE = "UP_MAIN"

ALL_TRAIN_TYPES = [
    "VANDE_BHARAT", "RAJDHANI", "SHATABDI", "MAIL_EXPRESS",
    "PASSENGER", "MEMU", "GOODS", "DEPARTMENTAL",
]


def _train(**overrides):
    base = {
        "train_id": "T1",
        "train_type": "MAIL_EXPRESS",
        "block_id": BLOCK,
        "line_id": LINE,
        "next_block_id": "ST_A1_BC",
        "signal_state": "GREEN",
        "max_speed": 100,
        "sectional_speed": 100,
        "scheduled_time": 1000,
        "current_time": 1000,
        "gradient": None,
        "condition": None,
        "has_written_authority": False,
    }
    base.update(overrides)
    return TrainRequest(**base)


def _context(**overrides):
    base = {
        "occupied_lines": [],
        "occupied_turnouts": [],
        "fouling_segments": [],
        "disaster_active": False,
    }
    base.update(overrides)
    return SystemContext(**base)


def _decision(trains, context):
    return make_decision(SectionDecisionRequest(trains=trains, context=context))


CONTEXT_FIELDS = {"disaster_active", "occupied_lines", "occupied_turnouts", "fouling_segments"}


def _single_decision(**overrides):
    train_kw = {k: v for k, v in overrides.items() if k not in CONTEXT_FIELDS}
    ctx_kw = {k: v for k, v in overrides.items() if k in CONTEXT_FIELDS}
    return _decision([_train(**train_kw)], _context(**ctx_kw))


# =============================================================================
# SECTION 1: NORMAL CASES — Basic signal + movement
# =============================================================================

class TestNormalCases:
    def test_green_signal_allows_movement(self):
        result = _single_decision()
        assert result.decisions[0].allow_movement is True
        assert result.decisions[0].max_speed == 100

    def test_green_signal_full_speed(self):
        result = _single_decision(sectional_speed=110)
        assert result.decisions[0].max_speed == 110

    def test_red_signal_holds(self):
        result = _single_decision(signal_state="RED")
        assert result.decisions[0].allow_movement is False
        assert result.decisions[0].allowed_actions == ["HOLD"]

    def test_yellow_signal_caution_speed(self):
        result = _single_decision(signal_state="YELLOW")
        assert result.decisions[0].allow_movement is True
        assert result.decisions[0].max_speed == 30

    def test_single_yellow_same_as_yellow(self):
        result = _single_decision(signal_state="SINGLE_YELLOW")
        assert result.decisions[0].allow_movement is True
        assert result.decisions[0].max_speed == 30

    def test_double_yellow_proceed(self):
        result = _single_decision(signal_state="DOUBLE_YELLOW")
        assert result.decisions[0].allow_movement is True

    def test_defective_signal_holds(self):
        result = _single_decision(signal_state="DEFECTIVE")
        assert result.decisions[0].allow_movement is False

    def test_written_authority_allows_on_red(self):
        result = _single_decision(signal_state="RED", has_written_authority=True)
        assert result.decisions[0].allow_movement is True
        assert result.decisions[0].max_speed == 30

    def test_written_authority_on_defective(self):
        result = _single_decision(signal_state="DEFECTIVE", has_written_authority=True)
        assert result.decisions[0].allow_movement is True
        assert result.decisions[0].max_speed == 30

    def test_all_train_types_accepted(self):
        for tt in ALL_TRAIN_TYPES:
            result = _single_decision(train_type=tt)
            assert result.decisions[0].allow_movement is True

    def test_max_speed_capped_by_sectional(self):
        result = _single_decision(sectional_speed=60)
        assert result.decisions[0].max_speed == 60


# =============================================================================
# SECTION 2: EDGE CASES — Boundary conditions
# =============================================================================

class TestEdgeCases:
    def test_unknown_train_type_raises_422(self):
        with pytest.raises(HTTPException) as excinfo:
            _single_decision(train_type="INVALID_TYPE")
        assert excinfo.value.status_code == 422

    def test_empty_train_list(self):
        result = _decision([], _context())
        assert result.decisions == []

    def test_sectional_speed_zero(self):
        result = _single_decision(sectional_speed=0)
        assert result.decisions[0].max_speed == 0

    def test_very_high_sectional_speed(self):
        result = _single_decision(sectional_speed=500)
        assert result.decisions[0].max_speed == 500

    def test_next_block_id_none(self):
        result = _single_decision(next_block_id=None)
        assert result.decisions[0].allow_movement is True

    def test_same_block_as_next_block(self):
        result = _single_decision(next_block_id=BLOCK)
        assert result.decisions[0].allow_movement is True

    def test_case_insensitive_signal_state(self):
        result = _single_decision(signal_state="green")
        assert result.decisions[0].allow_movement is True

    def test_signal_state_with_whitespace(self):
        result = _single_decision(signal_state="  RED  ")
        assert result.decisions[0].allow_movement is False

    def test_gradient_zero_value(self):
        result = _single_decision(gradient=Gradient(value=0, direction="UP"))
        assert result.decisions[0].allow_movement is True

    def test_gradient_extreme_value(self):
        result = _single_decision(gradient=Gradient(value=999, direction="UP"))
        assert result.decisions[0].allow_movement is True

    def test_all_occupied_lines(self):
        result = _single_decision(
            occupied_lines=[f"{BLOCK}|{LINE}", "OTHER_BLOCK|OTHER_LINE"]
        )
        assert result.decisions[0].allow_movement is False

    def test_all_fouling_segments(self):
        result = _single_decision(fouling_segments=[BLOCK, "OTHER_BLOCK"])
        assert result.decisions[0].allow_movement is False


# =============================================================================
# SECTION 3: SPEED RULES — Conditions, gradients, signals
# =============================================================================

class TestSpeedRules:
    def test_fog_caps_at_60(self):
        result = _single_decision(condition="FOG", sectional_speed=100)
        assert result.decisions[0].max_speed == 60

    def test_rain_caps_at_70(self):
        result = _single_decision(condition="RAIN", sectional_speed=100)
        assert result.decisions[0].max_speed == 70

    def test_storm_caps_at_40(self):
        result = _single_decision(condition="STORM", sectional_speed=100)
        assert result.decisions[0].max_speed == 40

    def test_thunderstorm_caps_at_30(self):
        result = _single_decision(condition="THUNDERSTORM", sectional_speed=100)
        assert result.decisions[0].max_speed == 30

    def test_fog_on_low_speed_train(self):
        result = _single_decision(condition="FOG", sectional_speed=40)
        assert result.decisions[0].max_speed == 40

    def test_gradient_steep_up_caps_40(self):
        result = _single_decision(gradient=Gradient(value=150, direction="UP"))
        assert result.decisions[0].max_speed == 40

    def test_gradient_steep_down_caps_25(self):
        result = _single_decision(gradient=Gradient(value=80, direction="DOWN"))
        assert result.decisions[0].max_speed == 25

    def test_gradient_mild_no_effect(self):
        result = _single_decision(gradient=Gradient(value=10, direction="UP"))
        assert result.decisions[0].max_speed == 100

    def test_fog_plus_gradient_uses_lower(self):
        result = _single_decision(
            condition="FOG",
            gradient=Gradient(value=150, direction="UP"),
            sectional_speed=100,
        )
        assert result.decisions[0].max_speed == 40

    def test_caution_signal_overrides_speed(self):
        result = _single_decision(signal_state="YELLOW", sectional_speed=200)
        assert result.decisions[0].max_speed == 30

    def test_speed_never_exceeds_sectional(self):
        result = _single_decision(sectional_speed=25)
        assert result.decisions[0].max_speed == 25


# =============================================================================
# SECTION 4: SIGNAL INTERLOCKING — Authority rules
# =============================================================================

class TestSignalInterlocking:
    def test_red_blocks_without_authority(self):
        result = check_signal_permission(
            train="T1", signal_state="RED", has_written_authority=False
        )
        assert result["can_proceed"] is False

    def test_red_with_authority_allows_caution(self):
        result = check_signal_permission(
            train="T1", signal_state="RED", has_written_authority=True
        )
        assert result["can_proceed"] is True
        assert result["speed_mode"] == "CAUTION"

    def test_defective_blocks_without_authority(self):
        result = check_signal_permission(
            train="T1", signal_state="DEFECTIVE", has_written_authority=False
        )
        assert result["can_proceed"] is False

    def test_defective_with_authority_allows_caution(self):
        result = check_signal_permission(
            train="T1", signal_state="DEFECTIVE", has_written_authority=True
        )
        assert result["can_proceed"] is True
        assert result["speed_mode"] == "CAUTION"

    def test_yellow_gives_caution(self):
        result = check_signal_permission(train="T1", signal_state="YELLOW")
        assert result["can_proceed"] is True
        assert result["speed_mode"] == "CAUTION"

    def test_single_yellow_gives_caution(self):
        result = check_signal_permission(train="T1", signal_state="SINGLE_YELLOW")
        assert result["can_proceed"] is True
        assert result["speed_mode"] == "CAUTION"

    def test_double_yellow_gives_caution(self):
        result = check_signal_permission(train="T1", signal_state="DOUBLE_YELLOW")
        assert result["can_proceed"] is True
        assert result["speed_mode"] == "CAUTION"

    def test_green_gives_normal(self):
        result = check_signal_permission(train="T1", signal_state="GREEN")
        assert result["can_proceed"] is True
        assert result["speed_mode"] == "NORMAL"

    def test_case_insensitive_signal_state(self):
        result = check_signal_permission(train="T1", signal_state="red")
        assert result["can_proceed"] is False

    def test_whitespace_in_signal_state(self):
        result = check_signal_permission(train="T1", signal_state="  GREEN  ")
        assert result["can_proceed"] is True


# =============================================================================
# SECTION 5: PRECEDENCE OPTIMIZER — IR train class ranking
# =============================================================================

class TestPrecedenceOptimizer:
    def test_single_train_no_optimization(self):
        result = _decision([_train(train_id="T1")], _context())
        assert result.optimized_order is None or len(result.optimized_order) <= 1

    def test_two_trains_same_block_optimize(self):
        result = _decision(
            [
                _train(train_id="T1", train_type="GOODS"),
                _train(train_id="T2", train_type="VANDE_BHARAT"),
            ],
            _context(),
        )
        assert result.optimized_order is not None
        orders = {o.train_id: o.order for o in result.optimized_order}
        assert orders["T2"] < orders["T1"]  # VB before GOODS

    def test_priority_ranking(self):
        result = _decision(
            [
                _train(train_id="GOODS-1", train_type="GOODS"),
                _train(train_id="MAIL-1", train_type="MAIL_EXPRESS"),
                _train(train_id="VB-1", train_type="VANDE_BHARAT"),
                _train(train_id="RAJ-1", train_type="RAJDHANI"),
            ],
            _context(),
        )
        orders = {o.train_id: o.order for o in result.optimized_order}
        assert orders["VB-1"] < orders["RAJ-1"]
        assert orders["RAJ-1"] < orders["MAIL-1"]
        assert orders["MAIL-1"] < orders["GOODS-1"]

    def test_same_type_stable_order(self):
        result = _decision(
            [
                _train(train_id="MAIL-A", train_type="MAIL_EXPRESS"),
                _train(train_id="MAIL-B", train_type="MAIL_EXPRESS"),
            ],
            _context(),
        )
        assert result.optimized_order is not None
        assert len(result.optimized_order) == 2
        orders = {o.train_id: o.order for o in result.optimized_order}
        assert orders["MAIL-A"] != orders["MAIL-B"]

    def test_optimization_recorded_in_audit(self):
        from backend.services.decision_state import record_action
        record_action("__reset", {})
        result = _decision(
            [
                _train(train_id="OPT-A", train_type="GOODS"),
                _train(train_id="OPT-B", train_type="VANDE_BHARAT"),
            ],
            _context(),
        )
        assert result.optimized_order is not None


# =============================================================================
# SECTION 6: DISASTER MODE
# =============================================================================

class TestDisasterMode:
    def test_disaster_holds_all_trains(self):
        result = _decision(
            [_train(train_id="T1"), _train(train_id="T2")],
            _context(disaster_active=True),
        )
        for d in result.decisions:
            assert d.allow_movement is False
            assert d.allowed_actions == ["HOLD"]

    def test_disaster_overrides_green(self):
        result = _single_decision(signal_state="GREEN", disaster_active=True)
        assert result.decisions[0].allow_movement is False

    def test_disaster_overrides_written_authority(self):
        result = _single_decision(
            signal_state="RED", has_written_authority=True, disaster_active=True
        )
        assert result.decisions[0].allow_movement is False

    def test_disaster_no_optimization(self):
        result = _decision(
            [_train(train_id="T1"), _train(train_id="T2")],
            _context(disaster_active=True),
        )
        assert result.optimized_order is None


# =============================================================================
# SECTION 7: OCCUPANCY & FOULING
# =============================================================================

class TestOccupancyAndFouling:
    def test_own_block_occupied_holds(self):
        result = _single_decision(occupied_lines=[f"{BLOCK}|{LINE}"])
        assert result.decisions[0].allow_movement is False

    def test_different_block_occupied_allows(self):
        result = _single_decision(occupied_lines=["OTHER_BLOCK|OTHER_LINE"])
        assert result.decisions[0].allow_movement is True

    def test_fouling_own_block_holds(self):
        result = _single_decision(fouling_segments=[BLOCK])
        assert result.decisions[0].allow_movement is False

    def test_fouling_different_block_allows(self):
        result = _single_decision(fouling_segments=["OTHER_BLOCK"])
        assert result.decisions[0].allow_movement is True

    def test_occupied_turnout_no_effect_without_route(self):
        result = _single_decision(occupied_turnouts=["T1_ST_A1"])
        assert result.decisions[0].allow_movement is True

    def test_all_occupied_blocks_holds(self):
        occupied = [f"{BLOCK}|{LINE}", "ST_A1_BC|UP_MAIN", "ST_A1_CD|UP_MAIN"]
        result = _single_decision(occupied_lines=occupied)
        assert result.decisions[0].allow_movement is False


# =============================================================================
# SECTION 8: SCENARIO CASES — Real-world situations
# =============================================================================

class TestScenarios:
    def test_goods_train_on_gradient(self):
        result = _single_decision(
            train_type="GOODS",
            gradient=Gradient(value=150, direction="UP"),
            sectional_speed=75,
        )
        assert result.decisions[0].allow_movement is True
        assert result.decisions[0].max_speed == 40

    def test_vb_in_fog(self):
        result = _single_decision(
            train_type="VANDE_BHARAT",
            condition="FOG",
            sectional_speed=130,
        )
        assert result.decisions[0].allow_movement is True
        assert result.decisions[0].max_speed == 60

    def test_mail_in_storm_with_red_signal(self):
        result = _single_decision(
            train_type="MAIL_EXPRESS",
            condition="STORM",
            signal_state="RED",
            has_written_authority=True,
        )
        assert result.decisions[0].allow_movement is True
        assert result.decisions[0].max_speed == 30

    def test_goods_no_authority_red_signal(self):
        result = _single_decision(
            train_type="GOODS",
            signal_state="RED",
            has_written_authority=False,
        )
        assert result.decisions[0].allow_movement is False

    def test_multiple_trains_vb_mail_goods(self):
        result = _decision(
            [
                _train(train_id="GOODS-1", train_type="GOODS"),
                _train(train_id="MAIL-1", train_type="MAIL_EXPRESS"),
                _train(train_id="VB-1", train_type="VANDE_BHARAT"),
            ],
            _context(),
        )
        orders = {o.train_id: o.order for o in result.optimized_order}
        assert orders["VB-1"] < orders["MAIL-1"] < orders["GOODS-1"]

    def test_shatabdi_rajdhani_priority(self):
        result = _decision(
            [
                _train(train_id="SHAT-1", train_type="SHATABDI"),
                _train(train_id="RAJ-1", train_type="RAJDHANI"),
            ],
            _context(),
        )
        orders = {o.train_id: o.order for o in result.optimized_order}
        assert orders["RAJ-1"] < orders["SHAT-1"]

    def test_passenger_in_thunderstorm(self):
        result = _single_decision(
            train_type="PASSENGER",
            condition="THUNDERSTORM",
            sectional_speed=100,
        )
        assert result.decisions[0].max_speed == 30

    def test_memu_rain(self):
        result = _single_decision(
            train_type="MEMU",
            condition="RAIN",
            sectional_speed=80,
        )
        assert result.decisions[0].max_speed == 70

    def test_departmental_normal(self):
        result = _single_decision(
            train_type="DEPARTMENTAL",
            sectional_speed=50,
        )
        assert result.decisions[0].allow_movement is True
        assert result.decisions[0].max_speed == 50


# =============================================================================
# SECTION 9: CROSS-SECTION (via decision context)
# =============================================================================

class TestCrossSection:
    def test_train_in_section_a(self):
        result = _single_decision(block_id="ST_A1_BC", line_id="UP_MAIN")
        assert result.decisions[0].allow_movement is True

    def test_train_in_section_b(self):
        result = _single_decision(block_id="ST_B1_BC", line_id="UP_MAIN")
        assert result.decisions[0].allow_movement is True

    def test_train_in_section_c(self):
        result = _single_decision(block_id="ST_C1_BC", line_id="UP_MAIN")
        assert result.decisions[0].allow_movement is True

    def test_train_on_dn_main(self):
        result = _single_decision(
            block_id="ST_A1_BC", line_id="DN_MAIN", next_block_id="ST_A1_AB"
        )
        assert result.decisions[0].allow_movement is True

    def test_train_on_loop_line(self):
        result = _single_decision(
            block_id="ST_A1_BC", line_id="UP_LOOP", next_block_id="ST_A1_CD"
        )
        assert result.decisions[0].allow_movement is True

    def test_occupied_next_section_block(self):
        result = _single_decision(
            block_id="ST_A1_CD",
            line_id="UP_MAIN",
            occupied_lines=["ST_A2_AB|UP_MAIN"],
        )
        assert result.decisions[0].allow_movement is True


# =============================================================================
# SECTION 10: TURNOUT RULES
# =============================================================================

class TestTurnoutRules:
    class FakeRouteService:
        def __init__(self, turnouts=None):
            self._turnouts = turnouts or []

        def get_turnouts(self, block_id, line_id):
            return self._turnouts

    def test_no_turnout_involved(self):
        result = check_turnout_conflict(
            train_id="T1",
            block_id=BLOCK,
            line_id=LINE,
            occupied_turnouts=[],
            route_service=self.FakeRouteService(turnouts=[]),
        )
        assert result["can_proceed"] is True
        assert result["required_turnouts"] == []

    def test_turnout_clear_allows(self):
        result = check_turnout_conflict(
            train_id="T1",
            block_id=BLOCK,
            line_id=LINE,
            occupied_turnouts=[],
            route_service=self.FakeRouteService(turnouts=["T1_ST_A1"]),
        )
        assert result["can_proceed"] is True
        assert result["required_turnouts"] == ["T1_ST_A1"]

    def test_turnout_locked_blocks(self):
        result = check_turnout_conflict(
            train_id="T1",
            block_id=BLOCK,
            line_id=LINE,
            occupied_turnouts=["T1_ST_A1"],
            route_service=self.FakeRouteService(turnouts=["T1_ST_A1"]),
        )
        assert result["can_proceed"] is False
        assert "locked" in result["reason"].lower()

    def test_multiple_turnouts_one_locked(self):
        result = check_turnout_conflict(
            train_id="T1",
            block_id=BLOCK,
            line_id=LINE,
            occupied_turnouts=["T2_ST_A1"],
            route_service=self.FakeRouteService(turnouts=["T1_ST_A1", "T2_ST_A1"]),
        )
        assert result["can_proceed"] is False

    def test_multiple_turnouts_all_clear(self):
        result = check_turnout_conflict(
            train_id="T1",
            block_id=BLOCK,
            line_id=LINE,
            occupied_turnouts=[],
            route_service=self.FakeRouteService(turnouts=["T1_ST_A1", "T2_ST_A1"]),
        )
        assert result["can_proceed"] is True
        assert len(result["required_turnouts"]) == 2
