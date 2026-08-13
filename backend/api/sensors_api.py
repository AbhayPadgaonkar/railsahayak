import json
from pathlib import Path

from fastapi import APIRouter

from backend.services.decision_state import active_decisions
from backend.services.section_sim import section_sim

router = APIRouter()

YARDS_DIR = Path(__file__).resolve().parent.parent / "config" / "yards"

_yard_cache: dict = {}


def _load_yard(station_id: str = "demo_yard") -> dict:
    if station_id not in _yard_cache:
        path = YARDS_DIR / f"{station_id}.json"
        _yard_cache[station_id] = json.loads(path.read_text(encoding="utf-8"))
    return _yard_cache[station_id]


def _section_containing(sections: list, line_id: str, x: float):
    for section in sections:
        if section["line"] == line_id and section["from_x"] <= x <= section["to_x"]:
            return section["id"]
    return None


@router.get("/sensors")
def get_sensor_snapshot():
    section_sim.tick()
    yard = _load_yard()
    sections = yard.get("sections", [])
    occupied_keys = section_sim.occupied_lines()

    zones = {
        section["id"]: f"{section['block']}|{section['line']}" in occupied_keys
        for section in sections
    }

    # Signal aspect: red when the signal's own section is occupied or an adjacent
    # section on the same line is occupied (traffic approaching/occupying the block).
    def is_red(section_id: str) -> bool:
        if section_id in zones and zones[section_id]:
            return True
        section = next((s for s in sections if s["id"] == section_id), None)
        if not section:
            return False
        for other in sections:
            if other["line"] != section["line"]:
                continue
            if other["from_x"] == section["to_x"] or other["to_x"] == section["from_x"]:
                if zones.get(other["id"]):
                    return True
        return False

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
        "trains": active_decisions(),
    }