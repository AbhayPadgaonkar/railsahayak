from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, List

from backend.services.kpi_state import get_history, record_snapshot

router = APIRouter()


class AdvisoriesKpi(BaseModel):
    HIGH: int
    MEDIUM: int
    LOW: int


class ActionsKpi(BaseModel):
    accept: int
    dismiss: int
    total: int


class KpiSnapshot(BaseModel):
    ts: str
    active_trains: int
    block_utilization_pct: float
    average_delay_min: float
    punctuality_pct: float
    throughput_trains_per_hour: float
    advisories: AdvisoriesKpi
    actions: ActionsKpi


class KpiHistoryResponse(BaseModel):
    history: List[KpiSnapshot]


@router.get("/kpis", response_model=KpiHistoryResponse)
def get_kpis():
    record_snapshot()
    return KpiHistoryResponse(history=get_history())
