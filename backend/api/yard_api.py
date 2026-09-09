import json
import re
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.api.permissions import (
    ControllerSection,
    assert_station_allowed,
    get_controller_section,
)

router = APIRouter()

YARDS_DIR = Path(__file__).resolve().parent.parent / "config" / "yards"
CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"

STATION_ID_PATTERN = re.compile(r"^[a-z0-9_-]+$")


@router.get("/sections")
def list_sections():
    """Line + section model (controllers, station ownership) for grouping the
    station picker by section."""
    path = CONFIG_DIR / "sections.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="No sections.json configured")
    return json.loads(path.read_text(encoding="utf-8"))


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
def get_yard_layout(
    station_id: str,
    section: Annotated[ControllerSection, Depends(get_controller_section)],
):
    assert_station_allowed(station_id, section)
    station = station_id.lower()
    if not STATION_ID_PATTERN.match(station):
        raise HTTPException(status_code=400, detail="Invalid station id")

    path = YARDS_DIR / f"{station}.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"No yard layout for station '{station}'")

    return json.loads(path.read_text(encoding="utf-8"))


class YardSaveRequest(BaseModel):
    station_id: str
    station_name: str
    canvas: dict
    lines: list[dict]
    turnouts: list[dict]
    signals: list[dict]
    blocks: list[dict]
    sections: list[dict] | None = None
    labels: list[dict] | None = None


@router.post("/yard/save")
def save_yard_layout(payload: YardSaveRequest):
    station = payload.station_id.lower()
    if not STATION_ID_PATTERN.match(station):
        raise HTTPException(status_code=400, detail="Invalid station id")

    yard_data = payload.model_dump()
    path = YARDS_DIR / f"{station}.json"
    path.write_text(json.dumps(yard_data, indent=2), encoding="utf-8")
    return {"status": "ok", "path": str(path)}
