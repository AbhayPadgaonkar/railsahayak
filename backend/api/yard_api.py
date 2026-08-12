import json
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

YARDS_DIR = Path(__file__).resolve().parent.parent / "config" / "yards"

STATION_ID_PATTERN = re.compile(r"^[a-z0-9_-]+$")


@router.get("/yards")
def list_yards():
    entries = []
    for path in sorted(YARDS_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        entries.append(
            {
                "station_id": path.stem,
                "station_name": data.get("station_name", path.stem),
            }
        )
    return entries


@router.get("/yard/{station_id}")
def get_yard_layout(station_id: str):
    station = station_id.lower()
    if not STATION_ID_PATTERN.match(station):
        raise HTTPException(status_code=400, detail="Invalid station id")

    path = YARDS_DIR / f"{station}.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"No yard layout for station '{station}'")

    return json.loads(path.read_text(encoding="utf-8"))
