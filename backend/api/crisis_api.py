import json
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.crisis_state import (
    SEVERITIES,
    crisis_types,
    declare_crisis,
    disaster_active,
    list_crises,
    resolve_crisis,
)
from backend.services.section_sim import section_sim

router = APIRouter()

CONFIG = Path(__file__).resolve().parent.parent / "config"


class CrisisTypeInfo(BaseModel):
    type: str
    label: str
    is_disaster: bool
    default_severity: str
    default_action: str


class Crisis(BaseModel):
    id: str
    type: str
    label: str
    is_disaster: bool
    severity: str
    location: str
    block_id: Optional[str] = None
    description: str
    status: str
    declared_at: str
    resolved_at: Optional[str] = None
    affected_trains: List[str] = []
    station_name: Optional[str] = None


class CrisisListResponse(BaseModel):
    disaster_active: bool
    types: List[CrisisTypeInfo]
    stations: List[dict]
    crises: List[Crisis]


class DeclareCrisisRequest(BaseModel):
    crisis_type: str
    severity: Optional[str] = None
    location: str
    block_id: Optional[str] = None
    description: Optional[str] = None


class CrisisResponse(BaseModel):
    crisis: Crisis


class ResolveCrisisRequest(BaseModel):
    crisis_id: str


def _yard_meta() -> dict:
    path = CONFIG / "yards"
    entries = {}
    for p in sorted(path.glob("*.json")):
        data = json.loads(p.read_text(encoding="utf-8"))
        entries[p.stem] = data.get("station_name", p.stem)
    return entries


def _stations() -> List[dict]:
    line_cfg = json.loads((CONFIG / "sections.json").read_text(encoding="utf-8"))
    return [{"station_id": sid, "name": _yard_meta().get(sid, sid)} for sid in line_cfg["line_order"]]


def _affected_trains(location: str, block_id: Optional[str] = None) -> List[str]:
    section_sim.tick()
    result = []
    for t in section_sim.trains:
        station = section_sim._block_station.get(t.block_id)
        if station == location:
            if block_id and t.block_id != block_id:
                continue
            result.append(t.train_id)
    return result


def _to_crisis(c: dict) -> Crisis:
    meta = _yard_meta()
    return Crisis(
        id=c["id"],
        type=c["type"],
        label=c["label"],
        is_disaster=c["is_disaster"],
        severity=c["severity"],
        location=c["location"],
        block_id=c.get("block_id"),
        description=c["description"],
        status=c["status"],
        declared_at=c["declared_at"],
        resolved_at=c.get("resolved_at"),
        affected_trains=_affected_trains(c["location"], c.get("block_id"))
        if c["status"] == "ACTIVE"
        else [],
        station_name=meta.get(c["location"], c["location"]),
    )


@router.get("/crisis", response_model=CrisisListResponse)
def get_crises():
    return CrisisListResponse(
        disaster_active=disaster_active(),
        types=[CrisisTypeInfo(**t) for t in crisis_types()],
        stations=_stations(),
        crises=[_to_crisis(c) for c in list_crises()],
    )


@router.post("/crisis", response_model=CrisisResponse)
def declare(payload: DeclareCrisisRequest):
    if payload.crisis_type not in {t["type"] for t in crisis_types()}:
        raise HTTPException(status_code=422, detail="Unknown crisis type")
    if payload.severity and payload.severity not in SEVERITIES:
        raise HTTPException(status_code=422, detail="Unknown severity")
    try:
        crisis = declare_crisis(
            payload.crisis_type,
            payload.severity,
            payload.location,
            payload.block_id,
            payload.description,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return CrisisResponse(crisis=_to_crisis(crisis))


@router.post("/crisis/resolve", response_model=CrisisResponse)
def resolve(payload: ResolveCrisisRequest):
    crisis = resolve_crisis(payload.crisis_id)
    if crisis is None:
        raise HTTPException(status_code=404, detail=f"Unknown crisis '{payload.crisis_id}'")
    return CrisisResponse(crisis=_to_crisis(crisis))