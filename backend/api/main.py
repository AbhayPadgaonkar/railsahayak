from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

from backend.rules.signals import check_signal_permission
from backend.rules.tracks import check_block_entry, check_fouling
from backend.rules.speed import determine_speed_limit
from backend.rules.emergency import emergency_mode_decision
from backend.api.sensors_api import router as sensor_router
from backend.domain.trains import TrainType, build_train_profile




app = FastAPI(
    title="RailSahayak Decision API",
    description="G&SR-compliant railway decision support system",
    version="1.0.0"
)

app.include_router(sensor_router)

# Data Models (Request / Response)

class Gradient(BaseModel):
    value: int           
    direction: str       

class TrainRequest(BaseModel):
    train_id: str
    train_type: str
    block_id: str
    signal_state: str
    sectional_speed: int
    gradient: Optional[Gradient] = None
    condition: Optional[str] = None
    has_written_authority: bool = False


class SystemContext(BaseModel):
    occupied_blocks: List[str]
    fouling_segments: List[str]
    disaster_active: bool = False


class SectionDecisionRequest(BaseModel):
    trains: List[TrainRequest]
    context: SystemContext


class DecisionResponse(BaseModel):
    train_id: str
    allow_movement: bool
    allowed_actions: List[str]
    max_speed: Optional[int]
    reasons: List[str]


# Core Decision Endpoint

@app.post("/decision", response_model=List[DecisionResponse])


def make_decision(payload: SectionDecisionRequest):

    results = []

    emergency = emergency_mode_decision(payload.context.disaster_active)
    if not emergency["optimization_allowed"]:
        for train in payload.trains:
            results.append(
                DecisionResponse(
                    train_id=train.train_id,
                    allow_movement=False,
                    allowed_actions=emergency["allowed_actions"],
                    max_speed=None,
                    reasons=[emergency["reason"]],
                )
            )
        return results

    for train in payload.trains:
        reasons = []

        signal_result = check_signal_permission(
            train=train.train_id,
            signal_state=train.signal_state,
            has_written_authority=train.has_written_authority,
        )

        if not signal_result["can_proceed"]:
            results.append(
                DecisionResponse(
                    train_id=train.train_id,
                    allow_movement=False,
                    allowed_actions=["HOLD"],
                    max_speed=None,
                    reasons=[signal_result["reason"]],
                )
            )
            continue

        reasons.append(signal_result["reason"])

        block_result = check_block_entry(
            train_id=train.train_id,
            block_id=train.block_id,
            occupied_blocks=payload.context.occupied_blocks,
        )

        if not block_result["can_enter"]:
            results.append(
                DecisionResponse(
                    train_id=train.train_id,
                    allow_movement=False,
                    allowed_actions=["HOLD"],
                    max_speed=None,
                    reasons=[block_result["reason"]],
                )
            )
            continue

        reasons.append(block_result["reason"])

        fouling_result = check_fouling(
            track_segment=train.block_id,
            fouling_segments=payload.context.fouling_segments,
        )

        if not fouling_result["safe"]:
            results.append(
                DecisionResponse(
                    train_id=train.train_id,
                    allow_movement=False,
                    allowed_actions=["HOLD"],
                    max_speed=None,
                    reasons=[fouling_result["reason"]],
                )
            )
            continue

        reasons.append(fouling_result["reason"])

        profile = build_train_profile(
            train_id=train.train_id,
            train_type=TrainType[train.train_type],
            max_speed=train.sectional_speed,
        )

        speed_result = determine_speed_limit(
            sectional_speed=train.sectional_speed,
            condition=train.condition,
            gradient=train.gradient,
        )

        reasons.append(speed_result["reason"])

        allowed_actions = ["PROCEED", "HOLD", "MAINTAIN_SPEED", "DIVERT"]
        if speed_result["max_speed"] <= 30:
            allowed_actions.remove("PROCEED")

        results.append(
            DecisionResponse(
                train_id=train.train_id,
                allow_movement=True,
                allowed_actions=allowed_actions,
                max_speed=speed_result["max_speed"],
                reasons=reasons,
            )
        )

    return results


# Health Check

@app.get("/health")
def health_check():
    return {"status": "RailSahayak API running"}
