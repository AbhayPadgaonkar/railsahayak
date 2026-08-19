from backend.rules.turnouts import check_turnout_conflict


class FakeRouteService:
    def __init__(self, turnouts=None):
        self._turnouts = turnouts or []

    def get_turnouts(self, block_id, line_id):
        return self._turnouts


def test_no_turnout_involved():
    result = check_turnout_conflict(
        train_id="T1",
        block_id="B1",
        line_id="L1",
        occupied_turnouts=[],
        route_service=FakeRouteService(),
    )
    assert result["can_proceed"] is True
    assert result["required_turnouts"] == []


def test_turnout_clear_allows_proceed():
    result = check_turnout_conflict(
        train_id="T1",
        block_id="B1",
        line_id="L1",
        occupied_turnouts=[],
        route_service=FakeRouteService(turnouts=["T1_B1"]),
    )
    assert result["can_proceed"] is True
    assert result["required_turnouts"] == ["T1_B1"]


def test_turnout_locked_blocks():
    result = check_turnout_conflict(
        train_id="T1",
        block_id="B1",
        line_id="L1",
        occupied_turnouts=["T1_B1"],
        route_service=FakeRouteService(turnouts=["T1_B1"]),
    )
    assert result["can_proceed"] is False