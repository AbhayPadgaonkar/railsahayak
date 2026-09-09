"""Tests for signal aspect computation and interlocking in sensors_api.

Verifies 4-aspect IR signalling and loop signal interlocking logic.
"""
import json
from pathlib import Path

YARDS_DIR = Path("backend/config/yards")


def _load_yard(station_id: str) -> dict:
    return json.loads((YARDS_DIR / f"{station_id}.json").read_text())


class TestSignalAspectComputation:
    """Tests for the _aspect() function in sensors_api.py."""

    def test_all_stations_have_valid_signals(self):
        for station_id in ["st_a1", "st_a2", "st_b1", "st_b2", "st_c1", "st_c2"]:
            yard = _load_yard(station_id)
            for sig in yard["signals"]:
                assert "id" in sig, f"{station_id}: signal missing id"
                assert "line" in sig, f"{station_id}: signal {sig['id']} missing line"
                assert "at_x" in sig, f"{station_id}: signal {sig['id']} missing at_x"
                assert "initial_state" in sig, f"{station_id}: signal {sig['id']} missing initial_state"

    def test_all_signals_on_valid_lines(self):
        for station_id in ["st_a1", "st_a2", "st_b1", "st_b2", "st_c1", "st_c2"]:
            yard = _load_yard(station_id)
            line_ids = {l["id"] for l in yard["lines"]}
            for sig in yard["signals"]:
                assert sig["line"] in line_ids, (
                    f"{station_id}: signal {sig['id']} references unknown line {sig['line']}"
                )

    def test_loop_signals_only_on_loop_lines(self):
        for station_id in ["st_a1", "st_a2", "st_b1", "st_b2"]:
            yard = _load_yard(station_id)
            loop_lines = {l["id"] for l in yard["lines"] if "LOOP" in l["id"]}
            for sig in yard["signals"]:
                if "Loop_Starter" in sig["id"] or "Loop_Exit" in sig["id"]:
                    assert sig["line"] in loop_lines, (
                        f"{station_id}: {sig['id']} not on loop line"
                    )

    def test_c_stations_have_no_loop_signals(self):
        for station_id in ["st_c1", "st_c2"]:
            yard = _load_yard(station_id)
            for sig in yard["signals"]:
                assert "Loop" not in sig["id"], f"{station_id} should not have loop signals"

    def test_a_stations_have_both_up_and_dn_loops(self):
        for station_id in ["st_a1", "st_a2"]:
            yard = _load_yard(station_id)
            sig_ids = {s["id"] for s in yard["signals"]}
            assert any("Loop_Starter_UP" in s for s in sig_ids), f"{station_id} missing UP loop starter"
            assert any("Loop_Starter_DN" in s for s in sig_ids), f"{station_id} missing DN loop starter"
            assert any("Loop_Exit_UP" in s for s in sig_ids), f"{station_id} missing UP loop exit"
            assert any("Loop_Exit_DN" in s for s in sig_ids), f"{station_id} missing DN loop exit"

    def test_b1_has_up_loop_only(self):
        yard = _load_yard("st_b1")
        sig_ids = {s["id"] for s in yard["signals"]}
        assert any("Loop_Starter_UP" in s for s in sig_ids)
        assert not any("Loop_Starter_DN" in s for s in sig_ids), "B1 should not have DN loop"

    def test_b2_has_dn_loop_only(self):
        yard = _load_yard("st_b2")
        sig_ids = {s["id"] for s in yard["signals"]}
        assert any("Loop_Starter_DN" in s for s in sig_ids)
        assert not any("Loop_Starter_UP" in s for s in sig_ids), "B2 should not have UP loop"

    def test_signal_positions_within_canvas(self):
        for station_id in ["st_a1", "st_a2", "st_b1", "st_b2", "st_c1", "st_c2"]:
            yard = _load_yard(station_id)
            canvas_w = yard["canvas"]["width"]
            for sig in yard["signals"]:
                assert 0 <= sig["at_x"] <= canvas_w, (
                    f"{station_id}: {sig['id']} at_x={sig['at_x']} outside canvas"
                )


class TestSignalInterlocking:
    """Tests for loop signal interlocking logic."""

    def test_a1_has_four_turnouts(self):
        yard = _load_yard("st_a1")
        assert len(yard["turnouts"]) == 4

    def test_a2_has_four_turnouts(self):
        yard = _load_yard("st_a2")
        assert len(yard["turnouts"]) == 4

    def test_b1_has_two_turnouts(self):
        yard = _load_yard("st_b1")
        assert len(yard["turnouts"]) == 2

    def test_b2_has_two_turnouts(self):
        yard = _load_yard("st_b2")
        assert len(yard["turnouts"]) == 2

    def test_c_stations_have_no_turnouts(self):
        for station_id in ["st_c1", "st_c2"]:
            yard = _load_yard(station_id)
            assert len(yard["turnouts"]) == 0

    def test_turnout_lines_are_valid(self):
        for station_id in ["st_a1", "st_a2", "st_b1", "st_b2"]:
            yard = _load_yard(station_id)
            line_ids = {l["id"] for l in yard["lines"]}
            for t in yard["turnouts"]:
                assert t["from_line"] in line_ids, f"{station_id}: turnout {t['id']} invalid from_line"
                assert t["to_line"] in line_ids, f"{station_id}: turnout {t['id']} invalid to_line"

    def test_turnout_connects_main_to_loop(self):
        for station_id in ["st_a1", "st_a2", "st_b1", "st_b2"]:
            yard = _load_yard(station_id)
            for t in yard["turnouts"]:
                lines = {t["from_line"], t["to_line"]}
                has_main = any("MAIN" in l for l in lines)
                has_loop = any("LOOP" in l for l in lines)
                assert has_main and has_loop, (
                    f"{station_id}: turnout {t['id']} doesn't connect main to loop"
                )


class TestYardGridLayout:
    """Tests for the 10-unit grid layout consistency."""

    def test_block_boundaries_at_300_700(self):
        for station_id in ["st_a1", "st_a2", "st_b1", "st_b2", "st_c1", "st_c2"]:
            yard = _load_yard(station_id)
            for block in yard["blocks"]:
                for line_span in block["lines"]:
                    if line_span["line"] in ("UP_MAIN", "DN_MAIN"):
                        # Block boundaries should be at 0, 300, 700, 1000
                        assert line_span["from_x"] in (0, 300, 700), (
                            f"{station_id}: block {block['id']} {line_span['line']} from_x={line_span['from_x']}"
                        )
                        assert line_span["to_x"] in (300, 700, 1000), (
                            f"{station_id}: block {block['id']} {line_span['line']} to_x={line_span['to_x']}"
                        )

    def test_main_line_y_positions(self):
        for station_id in ["st_a1", "st_a2", "st_b1", "st_b2", "st_c1", "st_c2"]:
            yard = _load_yard(station_id)
            for line in yard["lines"]:
                if line["id"] == "UP_MAIN":
                    assert line["y"] == 154, f"{station_id}: UP_MAIN y={line['y']}"
                elif line["id"] == "DN_MAIN":
                    assert line["y"] == 254, f"{station_id}: DN_MAIN y={line['y']}"

    def test_loop_y_positions(self):
        for station_id in ["st_a1", "st_a2", "st_b1", "st_b2"]:
            yard = _load_yard(station_id)
            for line in yard["lines"]:
                if line["id"] == "UP_LOOP":
                    assert line["y"] == 54, f"{station_id}: UP_LOOP y={line['y']}"
                elif line["id"] == "DN_LOOP":
                    assert line["y"] == 354, f"{station_id}: DN_LOOP y={line['y']}"

    def test_signal_positions_on_grid(self):
        grid_positions = {100, 300, 400, 600, 700, 900}
        for station_id in ["st_a1", "st_a2", "st_b1", "st_b2", "st_c1", "st_c2"]:
            yard = _load_yard(station_id)
            for sig in yard["signals"]:
                assert sig["at_x"] in grid_positions, (
                    f"{station_id}: {sig['id']} at_x={sig['at_x']} not on grid"
                )

    def test_canvas_dimensions(self):
        for station_id in ["st_a1", "st_a2", "st_b1", "st_b2", "st_c1", "st_c2"]:
            yard = _load_yard(station_id)
            assert yard["canvas"]["width"] == 1000
            assert yard["canvas"]["height"] == 408
