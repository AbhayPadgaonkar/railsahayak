from types import SimpleNamespace

from backend.engine.block_release import release_line_if_cleared
from backend.engine.train_movement import advance_train


def test_advance_train_increases_position_by_speed_and_length():
    train = SimpleNamespace(speed_kmph=60, position=0.0)
    advance_train(train, delta_minutes=1, block_length_km=1.0)
    # 60 km/h for 1 min = 1 km -> position += 1.0 on 1 km block
    assert train.position == 1.0


def test_advance_train_caps_at_one():
    train = SimpleNamespace(speed_kmph=120, position=0.5)
    advance_train(train, delta_minutes=10, block_length_km=1.0)
    # would move 20 km, capped at 1.0
    assert train.position == 1.0


def test_advance_train_zero_speed_is_no_op():
    train = SimpleNamespace(speed_kmph=0, position=0.3)
    advance_train(train, delta_minutes=10, block_length_km=1.0)
    assert train.position == 0.3


def test_advance_train_negative_speed_is_no_op():
    train = SimpleNamespace(speed_kmph=-10, position=0.3)
    advance_train(train, delta_minutes=10, block_length_km=1.0)
    assert train.position == 0.3


def test_release_line_if_cleared_removes_key_when_position_full():
    train = SimpleNamespace(position=1.0, block_id="BLK_1", line_id="UP_MAIN", train_id="T1")
    occupied = {"BLK_1|UP_MAIN"}
    released = release_line_if_cleared(train, occupied)
    assert released is True
    assert "BLK_1|UP_MAIN" not in occupied


def test_release_line_if_cleared_does_nothing_when_position_partial():
    train = SimpleNamespace(position=0.5, block_id="BLK_1", line_id="UP_MAIN", train_id="T1")
    occupied = {"BLK_1|UP_MAIN"}
    released = release_line_if_cleared(train, occupied)
    assert released is False
    assert "BLK_1|UP_MAIN" in occupied


def test_release_line_if_cleared_ignores_missing_key():
    train = SimpleNamespace(position=1.0, block_id="BLK_1", line_id="UP_MAIN", train_id="T1")
    occupied = set()
    released = release_line_if_cleared(train, occupied)
    assert released is True
    assert occupied == set()
