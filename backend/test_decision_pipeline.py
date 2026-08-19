from fastapi import HTTPException
import pytest

from backend.services.decision_service import (
    Gradient,
    SectionDecisionRequest,
    SystemContext,
    TrainRequest,
    make_decision,
)

BLOCK = "ST_A1_AB"
LINE = "PROTO_LINE"


def _train(**overrides):
    base = dict(
        train_id="UP-999",
        train_type="MAIL_EXPRESS",
        block_id=BLOCK,
        line_id=LINE,
        next_block_id="ST_A1_BC",
        signal_state="GREEN",
        sectional_speed=100,
        scheduled_time=1000,
        current_time=1000,
        gradient=None,
        condition=None,
        has_written_authority=False,
    )
    base.update(overrides)
    return TrainRequest(**base)


def _context(**overrides):
    base = dict(
        occupied_lines=[],
        occupied_turnouts=[],
        fouling_segments=[],
        disaster_active=False,
    )
    base.update(overrides)
    return SystemContext(**base)


def _decision(trains, context):
    return make_decision(SectionDecisionRequest(trains=trains, context=context))


def test_clear_green_decision_allows_movement():
    result = _decision([_train()], _context())
    assert result.decisions[0].allow_movement is True
    assert result.decisions[0].max_speed == 100


def test_red_signal_holds():
    result = _decision([_train(signal_state="RED")], _context())
    assert result.decisions[0].allow_movement is False
    assert result.decisions[0].allowed_actions == ["HOLD"]


def test_red_signal_with_written_authority_proceeds_caution():
    result = _decision(
        [_train(signal_state="RED", has_written_authority=True)],
        _context(),
    )
    assert result.decisions[0].allow_movement is True
    assert result.decisions[0].max_speed == 30


def test_occupied_line_holds():
    result = _decision(
        [_train()],
        _context(occupied_lines=[f"{BLOCK}|{LINE}"]),
    )
    assert result.decisions[0].allow_movement is False
    assert result.decisions[0].allowed_actions == ["HOLD"]


def test_fouling_segment_holds():
    result = _decision(
        [_train()],
        _context(fouling_segments=[BLOCK]),
    )
    assert result.decisions[0].allow_movement is False


def test_fog_caps_speed_but_allows():
    result = _decision([_train(condition="FOG")], _context())
    assert result.decisions[0].allow_movement is True
    assert result.decisions[0].max_speed == 60


def test_gradient_steep_up_caps_speed():
    result = _decision(
        [_train(gradient=Gradient(value=150, direction="UP"))],
        _context(),
    )
    assert result.decisions[0].max_speed == 40


def test_disaster_mode_holds_all():
    result = _decision(
        [_train(signal_state="GREEN"), _train(train_id="DN-1", signal_state="GREEN")],
        _context(disaster_active=True),
    )
    for d in result.decisions:
        assert d.allow_movement is False
        assert d.allowed_actions == ["HOLD"]
    assert result.optimized_order is None


def test_two_trains_same_block_optimize_order():
    result = _decision(
        [
            _train(train_id="MAIL-A", signal_state="GREEN"),
            _train(train_id="MAIL-B", signal_state="GREEN"),
        ],
        _context(),
    )
    assert result.optimized_order is not None
    orders = {o.train_id: o.order for o in result.optimized_order}
    assert set(orders.keys()) == {"MAIL-A", "MAIL-B"}
    assert len(set(orders.values())) == 2


def test_unknown_train_type_raises_422():
    with pytest.raises(HTTPException) as excinfo:
        _decision([_train(train_type="NOT_A_TYPE")], _context())
    assert excinfo.value.status_code == 422


def test_decision_run_is_recorded_in_state():
    from backend.services.decision_state import active_decisions, record_action

    record_action("__reset", {})
    result = _decision([_train(train_id="UP-STATE")], _context())
    assert result.decisions[0].train_id == "UP-STATE"
    active = active_decisions()
    assert any(d["train_id"] == "UP-STATE" for d in active)