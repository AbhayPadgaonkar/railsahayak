import json
import time
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

YARDS_DIR = Path(__file__).resolve().parent.parent / "config" / "yards"

DWELL_SECONDS = 20

SIM_ROUTES = [
    ["TC_UP_ENTRY", "TC_UP_MID", "TC_UP_EXIT"],
    ["TC_DN_ENTRY", "TC_DN_MID", "TC_DN_EXIT"],
]

_start = time.monotonic()

_yard_cache: dict = {}


def _load_yard(station_id: str = "demo_yard") -> dict:
    if station_id not in _yard_cache:
        path = YARDS_DIR / f"{station_id}.json"
        _yard_cache[station_id] = json.loads(path.read_text(encoding="utf-8"))
    return _yard_cache[station_id]


def _occupied_zones(now: float) -> set:
    elapsed = now - _start
    occupied = set()
    for i, route in enumerate(SIM_ROUTES):
        idx = int(elapsed / DWELL_SECONDS + i * 2) % len(route)
        occupied.add(route[idx])
    return occupied


@router.get("/sensors")
def get_sensor_snapshot():
    yard = _load_yard()
    occupied = _occupied_zones(time.monotonic())

    zones = {
        zone["id"]: zone["id"] in occupied
        for zone in yard.get("sensor_zones", [])
    }

    def zone_containing(line_id: str, x: float):
        for zone in yard.get("sensor_zones", []):
            if zone["line"] == line_id and zone["from_x"] <= x <= zone["to_x"]:
                return zone["id"]
        return None

    signals = {}
    for signal in yard.get("signals", []):
        zone_id = zone_containing(signal["line"], signal["at_x"])
        signals[signal["id"]] = "red" if zone_id in occupied else "green"

    return {
        "station_id": yard["station_id"],
        "zones": zones,
        "signals": signals,
    }
