import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

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


def _live_decision_trains(station_id: str):
    """Merge active decisions with the live sim so markers track real movement.

    Only trains currently inside this station's blocks are reported, so each
    station's map shows its own traffic. A decided train that is running in the
    sim reports its current block/line (position updates as it moves); its
    decision fields (allow_movement, max_speed, signal_state) come from the
    decision store. Decisions without a matching sim train are passed through
    so a freshly-posted decision shows up immediately (the sim seeds it on the
    next tick)."""
    station_blocks = _station_blocks(station_id)
    sim_by_id = {t.train_id: t for t in section_sim.trains}
    for decision in active_decisions():
        sim = sim_by_id.get(decision["train_id"])
        block_id = sim.block_id if sim else decision["block_id"]
        line_id = sim.line_id if sim else decision["line_id"]
        if block_id not in station_blocks:
            continue
        if sim:
            yield {
                **decision,
                "block_id": block_id,
                "line_id": line_id,
            }
        else:
            yield decision


def _section_containing(sections: list, line_id: str, x: float):
    for section in sections:
        if section["line"] == line_id and section["from_x"] <= x <= section["to_x"]:
            return section["id"]
    return None


@router.get("/sensors")
def get_sensor_snapshot(station: str = Query(default=DEFAULT_STATION)):
    section_sim.tick()
    yard = _load_yard(station)
    sections = yard.get("sections", [])
    occupied_keys = section_sim.occupied_lines()

    zones = {
        section["id"]: f"{section['block']}|{section['line']}" in occupied_keys
        for section in sections
    }

    # Signal aspect: red when the signal's own section is occupied, or the next
    # block along the line's traversal is occupied (cross-station: the block in
    # the following station, or a train approaching on the same line).
    def is_red(section_id: str) -> bool:
        if zones.get(section_id):
            return True
        section = next((s for s in sections if s["id"] == section_id), None)
        if not section:
            return False
        nxt = section_sim._next_block_after(section["line"], section["block"])
        return bool(nxt and f"{nxt}|{section['line']}" in occupied_keys)

    signals = {}
    for signal in yard.get("signals", []):
        section_id = _section_containing(sections, signal["line"], signal["at_x"])
        if section_id is None:
            signals[signal["id"]] = "green"
            continue
        signals[signal["id"]] = "red" if is_red(section_id) else "green"

    return {
        "station_id": yard["station_id"],
        "zones": zones,
        "signals": signals,
        "trains": list(_live_decision_trains(station)),
    }