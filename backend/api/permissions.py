"""Authorization helpers and FastAPI dependencies for section scoping.

Controllers are matched to their territory via ``backend/config/sections.json``;
every guarded endpoint checks that the requested station/block belongs to one of
the stations owned by the controller's section.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Header, HTTPException

from backend.api.auth_api import _session_from_token
from backend.services.section_sim import section_sim

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


@lru_cache(maxsize=1)
def _load_sections() -> dict[str, dict]:
    """Return sections keyed by normalised controller_id."""
    path = CONFIG_DIR / "sections.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return {sec["controller_id"].lower(): sec for sec in data.get("sections", [])}


class ControllerSection:
    """Scoped section information for the currently authenticated controller."""

    def __init__(self, section_id: str, name: str, stations: list[str], controller_id: str):
        self.section_id = section_id
        self.name = name
        self.stations = [s.lower() for s in stations]
        self.controller_id = controller_id

    def owns_station(self, station_id: str) -> bool:
        return station_id.lower() in self.stations

    def owns_block(self, block_id: str) -> bool:
        station = section_sim._block_station.get(block_id)
        return station is not None and self.owns_station(station)


def get_current_session(authorization: str | None = Header(default=None)) -> dict:
    """Dependency: validate the bearer token and return the session payload."""
    return _session_from_token(authorization)


def get_controller_section(
    session: Annotated[dict, Depends(get_current_session)],
) -> ControllerSection:
    """Dependency: resolve the controller's assigned section from sections.json."""
    controller_id = session.get("controller_id", "").lower()
    mapping = _load_sections()
    section = mapping.get(controller_id)
    if section is None:
        raise HTTPException(
            status_code=403,
            detail=f"Controller '{controller_id}' is not assigned to any section",
        )
    return ControllerSection(
        section_id=section["section_id"],
        name=section["name"],
        stations=section["stations"],
        controller_id=session.get("controller_id", ""),
    )


def assert_station_allowed(station_id: str, section: ControllerSection) -> None:
    if not section.owns_station(station_id):
        raise HTTPException(
            status_code=403,
            detail=(
                f"Station '{station_id}' is outside controller "
                f"{section.controller_id}'s section ({section.name})"
            ),
        )


def assert_decision_allowed(payload, section: ControllerSection) -> None:
    """Ensure every train in a decision request is within the controller's section."""
    for train in payload.trains:
        if not section.owns_block(train.block_id):
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Block '{train.block_id}' is outside controller "
                    f"{section.controller_id}'s section"
                ),
            )
