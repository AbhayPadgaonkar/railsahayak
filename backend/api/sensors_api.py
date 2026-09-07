import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.api.permissions import (
    ControllerSection,
    assert_station_allowed,
    get_controller_section,
)
from backend.services.decision_state import active_decisions
from backend.services.section_sim import section_sim

router = APIRouter()

YARDS_DIR = Path(__file__).resolve().parent.parent / "config" / "yards"

_yard_cache: dict = {}

DEFAULT_STATION = "st_a1"


def _load_yard(station_id: str) -> dict:
    if station_id not in _yard_cache:
        path = YARDS_DIR / f"{station_id}.json"
        if not path.is_file():
            raise HTTPException(status_code=404, detail=f"No yard layout for station '{station_id}'")
        _yard_cache[station_id] = json.loads(path.read_text(encoding="utf-8"))
    return _yard_cache[station_id]


def _station_blocks(station_id: str) -> set:
    return {b["id"] for b in _load_yard(station_id).get("blocks", [])}


def _live_trains_for_station(station_id: str):
    """Return all trains currently inside this station's blocks.

    Merges decision-tracked trains (which carry G&SR fields like
    allow_movement, max_speed, signal_state) with timetable-driven sim
    trains that haven't been through the decision engine yet. Each train
    appears exactly once — decision state wins when available."""
    station_blocks = _station_blocks(station_id)
    sim_by_id = {t.train_id: t for t in section_sim.trains}
    seen: set[str] = set()

    for decision in active_decisions():
        sim = sim_by_id.get(decision["train_id"])
        block_id = sim.block_id if sim else decision["block_id"]
        line_id = sim.line_id if sim else decision["line_id"]
        if block_id not in station_blocks:
            continue
        seen.add(decision["train_id"])
        yield {
            **decision,
            "block_id": block_id,
            "line_id": line_id,
        }

    for t in section_sim.trains:
        if t.train_id in seen:
            continue
        if t.block_id not in station_blocks:
            continue
        yield {
            "train_id": t.train_id,
            "train_type": t.train_type,
            "block_id": t.block_id,
            "line_id": t.line_id,
            "allow_movement": True,
            "max_speed": t.speed_kmph,
            "signal_state": "GREEN",
        }


def _section_containing(sections: list, line_id: str, x: float):
    for section in sections:
        if section["line"] == line_id and section["from_x"] <= x <= section["to_x"]:
            return section["id"]
    return None


@router.get("/sensors")
def get_sensor_snapshot(
    section: Annotated[ControllerSection, Depends(get_controller_section)],
    station: str = Query(default=DEFAULT_STATION),
):
    assert_station_allowed(station, section)
    section_sim.tick()
    yard = _load_yard(station)
    sections = yard.get("sections", [])
    occupied_keys = section_sim.occupied_lines()

    zones = {
        section["id"]: f"{section['block']}|{section['line']}" in occupied_keys
        for section in sections
    }

    occupied_keys = section_sim.occupied_lines()

    def _is_occupied(block_id: str, line_id: str) -> bool:
        return f"{block_id}|{line_id}" in occupied_keys

    # 4-aspect IR-style signal logic:
    # - RED: own section occupied, or the very next block on the line is occupied.
    # - SINGLE_YELLOW: next block clear, but the block after that is occupied
    #   (the train must be prepared to stop at the next signal).
    # - DOUBLE_YELLOW: next two blocks clear, but the third block ahead is occupied
    #   (proceed, next signal will show single yellow).
    # - GREEN: at least the next two blocks ahead are clear.
    def _aspect(section_id: str) -> str:
        if zones.get(section_id):
            return "red"
        section = next((s for s in sections if s["id"] == section_id), None)
        if not section:
            return "green"
        line = section["line"]
        block = section["block"]
        nxt = section_sim._next_block_after(line, block)
        if not nxt:
            return "green"
        if _is_occupied(nxt, line):
            return "red"
        nxt2 = section_sim._next_block_after(line, nxt)
        if not nxt2:
            return "green"
        if _is_occupied(nxt2, line):
            return "single_yellow"
        nxt3 = section_sim._next_block_after(line, nxt2)
        if not nxt3 or _is_occupied(nxt3, line):
            return "double_yellow"
        return "green"

    signals = {}
    for signal in yard.get("signals", []):
        section_id = _section_containing(sections, signal["line"], signal["at_x"])
        if section_id is None:
            signals[signal["id"]] = "green"
            continue
        signals[signal["id"]] = _aspect(section_id)

    # --- Signal interlocking ---
    # Loop Starter can only clear if:
    #   1. The loop block ahead is clear
    #   2. A train is approaching from the main line (Home shows non-red)
    #      OR a train is already in the loop block
    # Loop Exit can only clear if:
    #   1. The main line block ahead is clear
    #   2. A train is in the loop block approaching the exit
    yard_blocks = yard.get("blocks", [])
    yard_signals = yard.get("signals", [])

    def _block_at(line_id, x):
        for blk in yard_blocks:
            for ln in blk.get("lines", []):
                if ln["line"] == line_id and ln["from_x"] <= x <= ln["to_x"]:
                    return blk["id"]
        return None

    sig_map = {s["id"]: s for s in yard_signals}

    for sig in yard_signals:
        sid = sig["id"]

        if "Loop_Starter" in sid:
            # Find the corresponding Home signal on the main line
            direction = "UP" if "UP" in sid else "DN"
            home_id = f"Home_{direction}_{sid.split('_')[-2]}_{sid.split('_')[-1]}"
            # Try pattern: Loop_Starter_UP_ST_A1 → Home_UP_ST_A1
            parts = sid.split("_")
            station_suffix = "_".join(parts[2:])  # e.g. ST_A1
            home_id = f"Home_{direction}_{station_suffix}"

            home_sig = sig_map.get(home_id)
            home_aspect = signals.get(home_id, "red")

            # Check if loop block ahead is clear
            loop_line = sig["line"]
            loop_x = sig["at_x"]
            loop_block = _block_at(loop_line, loop_x)
            loop_clear = not _is_occupied(loop_block, loop_line) if loop_block else False

            # Check if a train is approaching from main line (in the block before Home)
            train_approaching = False
            if home_sig:
                home_section = _section_containing(sections, home_sig["line"], home_sig["at_x"])
                if home_section:
                    sec = next((s for s in sections if s["id"] == home_section), None)
                    if sec:
                        prev_block = sec["block"]
                        prev_line = sec["line"]
                        train_approaching = _is_occupied(prev_block, prev_line)

            # Train already in loop?
            train_in_loop = False
            if loop_block:
                train_in_loop = _is_occupied(loop_block, loop_line)

            if not loop_clear or (not train_approaching and not train_in_loop):
                signals[sid] = "red"

        elif "Loop_Exit" in sid:
            # Find the corresponding Starter signal on the main line
            direction = "UP" if "UP" in sid else "DN"
            parts = sid.split("_")
            station_suffix = "_".join(parts[2:])
            starter_id = f"Starter_{direction}_{station_suffix}"

            starter_aspect = signals.get(starter_id, "red")

            # Check if main line block ahead is clear
            # The Loop Exit is at x=600 on UP_LOOP. The train re-joins UP_MAIN.
            # The next block on UP_MAIN starts at x=700 (Starter position).
            loop_line = sig["line"]
            loop_x = sig["at_x"]
            # Find the main line and the block after the rejoin point
            main_line = f"{direction}_MAIN"
            # The rejoin point is at the same x as the Starter signal
            main_x = loop_x  # rejoin at same x as loop exit
            main_block = _block_at(main_line, main_x)
            main_clear = not _is_occupied(main_block, main_line) if main_block else False

            # Train in the loop approaching exit?
            train_in_loop = False
            if loop_block := _block_at(loop_line, loop_x):
                # Check the block just before the loop exit signal
                for blk in yard_blocks:
                    for ln in blk.get("lines", []):
                        if ln["line"] == loop_line and ln["to_x"] == loop_x:
                            train_in_loop = _is_occupied(blk["id"], loop_line)

            if not main_clear or starter_aspect == "red":
                signals[sid] = "red"

    return {
        "station_id": yard["station_id"],
        "zones": zones,
        "signals": signals,
        "trains": list(_live_trains_for_station(station)),
    }