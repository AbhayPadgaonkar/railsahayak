"""Alert persistence API endpoints."""
import time

import prisma.errors
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.database import get_client

router = APIRouter()


class AlertCreate(BaseModel):
    alert_type: str
    severity: str
    title: str
    description: str
    station_id: str | None = None
    block_id: str | None = None
    train_id: str | None = None
    section: str
    status: str = "active"


class AlertResolve(BaseModel):
    alert_id: int


@router.get("/alerts")
def list_alerts(section: str | None = None, status: str | None = None):
    db = get_client()
    where: dict = {}
    if section:
        where["section"] = section
    if status:
        where["status"] = status
    rows = db.alert.find_many(where=where, order={"created_at": "desc"})
    return [
        {
            "id": r.id,
            "alert_type": r.alert_type,
            "severity": r.severity,
            "title": r.title,
            "description": r.description,
            "station_id": r.station_id,
            "block_id": r.block_id,
            "train_id": r.train_id,
            "section": r.section,
            "status": r.status,
            "created_at": r.created_at,
            "resolved_at": r.resolved_at,
        }
        for r in rows
    ]


@router.post("/alerts")
def create_alert(payload: AlertCreate):
    db = get_client()
    now = time.time()
    row = db.alert.create(
        data={
            "alert_type": payload.alert_type,
            "severity": payload.severity,
            "title": payload.title,
            "description": payload.description,
            "station_id": payload.station_id,
            "block_id": payload.block_id,
            "train_id": payload.train_id,
            "section": payload.section,
            "status": payload.status,
            "created_at": now,
        }
    )
    return {"id": row.id, "created_at": now}


@router.post("/alerts/resolve")
def resolve_alert(payload: AlertResolve):
    db = get_client()
    now = time.time()
    try:
        db.alert.update(
            where={"id": payload.alert_id},
            data={"status": "resolved", "resolved_at": now},
        )
    except prisma.errors.RecordNotFoundError:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"resolved_at": now}


@router.delete("/alerts/{alert_id}")
def delete_alert(alert_id: int):
    db = get_client()
    try:
        db.alert.delete(where={"id": alert_id})
    except prisma.errors.RecordNotFoundError:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"deleted": True}
