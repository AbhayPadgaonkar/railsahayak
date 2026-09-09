
import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

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
    history: list[KpiSnapshot]


@router.get("/kpis", response_model=KpiHistoryResponse)
def get_kpis():
    record_snapshot()
    return KpiHistoryResponse(history=get_history())


_kpi_clients: list[WebSocket] = []


@router.websocket("/ws/kpis")
async def kpi_websocket(ws: WebSocket):
    await ws.accept()
    _kpi_clients.append(ws)
    try:
        while True:
            snapshot = record_snapshot()
            data = {
                "ts": snapshot.ts,
                "active_trains": snapshot.active_trains,
                "block_utilization_pct": snapshot.block_utilization_pct,
                "average_delay_min": snapshot.average_delay_min,
                "punctuality_pct": snapshot.punctuality_pct,
                "throughput_trains_per_hour": snapshot.throughput_trains_per_hour,
                "advisories": snapshot.advisories,
                "actions": snapshot.actions,
            }
            await ws.send_text(json.dumps(data))
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        if ws in _kpi_clients:
            _kpi_clients.remove(ws)
    except OSError:
        if ws in _kpi_clients:
            _kpi_clients.remove(ws)
