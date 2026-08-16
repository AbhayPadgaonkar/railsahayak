from typing import List

from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend.services.decision_state import recent_actions

router = APIRouter()


class AuditEntry(BaseModel):
    action: str
    detail: dict
    at: str


class AuditLogResponse(BaseModel):
    logs: List[AuditEntry]


@router.get("/auditlogs", response_model=AuditLogResponse)
def get_audit_logs(limit: int = Query(default=50, ge=1, le=200)):
    return AuditLogResponse(logs=recent_actions(limit))