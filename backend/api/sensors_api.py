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

    return {
        "station_id": yard["station_id"],
        "zones": zones,
        "signals": signals,
        "trains": list(_live_trains_for_station(station)),
    }