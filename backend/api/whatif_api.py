from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.section_sim import section_sim
from backend.services.whatif_service import SCENARIOS, run_scenario, scenario_options

router = APIRouter()


class ScenarioOption(BaseModel):
    id: str
    label: str
    description: str


class ScenariosResponse(BaseModel):
    scenarios: List[ScenarioOption]
    trains: List[dict]


class WhatIfRunRequest(BaseModel):
    train_id: str
    train_type: str
    block_id: str
    line_id: str
    sectional_speed: int
    scenario_type: str
    parameter: Optional[float] = None
    direction: str = "UP"
    scheduled_time: int = 1000
    current_time: int = 1000
    gradient: Optional[dict] = None
    condition: Optional[str] = None


class WhatIfRunResponse(BaseModel):
    scenario_type: str
    scenario_label: str
    scenario_description: str
    train: dict
    predicted_delay: dict
    transit_impact_min: float
    movement: dict
    outcome: str


@router.get("/whatif/scenarios", response_model=ScenariosResponse)
def get_scenarios():
    section_sim.tick()
    trainees = [
        {
            "train_id": t.train_id,
            "train_type": t.train_type,
            "block_id": t.block_id,
            "line_id": t.line_id,
            "speed_kmph": t.speed_kmph,
        }
        for t in section_sim.trains
    ]
    return ScenariosResponse(
        scenarios=[
            ScenarioOption(id=so["id"], label=so["label"], description=so["description"])
            for so in scenario_options()
        ],
        trains=trainees,
    )


@router.post("/whatif/run", response_model=WhatIfRunResponse)
def run(payload: WhatIfRunRequest):
    if payload.scenario_type not in SCENARIOS:
        raise HTTPException(status_code=422, detail="Unknown scenario type")

    try:
        result = run_scenario(
            train_id=payload.train_id,
            train_type=payload.train_type,
            block_id=payload.block_id,
            line_id=payload.line_id,
            sectional_speed=payload.sectional_speed,
            scenario_type=payload.scenario_type,
            parameter=payload.parameter,
            direction=payload.direction,
            scheduled_time=payload.scheduled_time,
            current_time=payload.current_time,
            gradient=payload.gradient,
            condition=payload.condition,
        )
    except KeyError:
        raise HTTPException(status_code=422, detail="Invalid train_type")
    return WhatIfRunResponse(**result)