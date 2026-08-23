from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

from backend.services.rtis_replay import rtis_replay

router = APIRouter()


class RTISFeedSnapshot(BaseModel):
    train_id: str
    lat: float | None
    lon: float | None
    speed: float


class RTISResponse(BaseModel):
    elapsed_seconds: float
    finished: bool
    feeds: List[RTISFeedSnapshot]


@router.get("/rtis", response_model=RTISResponse)
def get_rtis_feed():
    feeds = rtis_replay.snapshots()
    return RTISResponse(
        elapsed_seconds=round(rtis_replay.elapsed_seconds(), 1),
        finished=rtis_replay.finished,
        feeds=[RTISFeedSnapshot(**feed) for feed in feeds],
    )


@router.post("/rtis/start")
def start_rtis_replay():
    rtis_replay.start()
    return {"status": "started"}
