from fastapi import APIRouter
from backend.simulation.sensor_state import SensorState

router = APIRouter()

sensor_state = SensorState()

@router.get("/sensors")
def get_sensor_snapshot():
    return sensor_state.snapshot()
