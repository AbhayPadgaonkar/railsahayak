from backend.rules.tracks import check_fouling, check_line_entry


def test_line_entry_clear():
    result = check_line_entry(
        train_id="T1",
        block_id="B1",
        line_id="L1",
        occupied_lines=[],
    )
    assert result["can_enter"] is True


def test_line_entry_blocked_when_occupied():
    result = check_line_entry(
        train_id="T1",
        block_id="B1",
        line_id="L1",
        occupied_lines=["B1|L1"],
    )
    assert result["can_enter"] is False


def test_line_entry_clear_for_different_line_same_block():
    result = check_line_entry(
        train_id="T1",
        block_id="B1",
        line_id="L2",
        occupied_lines=["B1|L1"],
    )
    assert result["can_enter"] is True


def test_line_entry_clear_for_same_line_different_block():
    result = check_line_entry(
        train_id="T1",
        block_id="B2",
        line_id="L1",
        occupied_lines=["B1|L1"],
    )
    assert result["can_enter"] is True


def test_fouling_detected():
    result = check_fouling(track_segment="B1", fouling_segments=["B1"])
    assert result["safe"] is False


def test_no_fouling():
    result = check_fouling(track_segment="B1", fouling_segments=[])
    assert result["safe"] is True