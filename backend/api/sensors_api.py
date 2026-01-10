from fastapi import APIRouter
from backend.simulation.sensor_state import SensorState

router = APIRouter()

sensor_state = SensorState()

sensor_state.add_block("upMain_1")
sensor_state.blocks["upMain_1"].axle_enter(16)

@router.get("/sensors")
def get_sensor_snapshot():
    return sensor_state.snapshot()
