from backend.rules.signals import check_signal_permission


def test_red_without_authority_blocks():
    result = check_signal_permission(
        train="T1", signal_state="RED", has_written_authority=False
    )
    assert result["can_proceed"] is False
    assert "authority" in result["reason"].lower()


def test_defective_without_authority_blocks():
    result = check_signal_permission(
        train="T1", signal_state="DEFECTIVE", has_written_authority=False
    )
    assert result["can_proceed"] is False


def test_red_with_written_authority_allows_caution():
    result = check_signal_permission(
        train="T1", signal_state="RED", has_written_authority=True
    )
    assert result["can_proceed"] is True
    assert result["speed_mode"] == "CAUTION"


def test_yellow_gives_caution_mode():
    result = check_signal_permission(train="T1", signal_state="YELLOW")
    assert result["can_proceed"] is True
    assert result["speed_mode"] == "CAUTION"


def test_green_gives_normal_mode():
    result = check_signal_permission(train="T1", signal_state="GREEN")
    assert result["can_proceed"] is True
    assert result["speed_mode"] == "NORMAL"