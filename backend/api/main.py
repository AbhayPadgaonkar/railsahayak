from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

from backend.rules.signals import check_signal_permission
from backend.rules.tracks import check_block_entry, check_fouling
from backend.rules.speed import determine_speed_limit
from backend.rules.emergency import emergency_mode_decision


app = FastAPI(
    title="RailSahayak Decision API",
    description="G&SR-compliant railway decision support system",
    version="1.0.0"
)

# Data Models (Request / Response)

class TrainRequest(BaseModel):
    train_id: str
    block_id: str
    signal_state: str              # GREEN / RED / DEFECTIVE
    sectional_speed: int
    gradient: Optional[float] = 0.0
    condition: Optional[str] = None   # FOG / STORM / OBSTRUCTION
    has_written_authority: bool = False


class SystemContext(BaseModel):
    occupied_blocks: List[str]
    fouling_segments: List[str]
    disaster_active: bool = False


class DecisionResponse(BaseModel):
    allow_movement: bool
    allowed_actions: List[str]
    max_speed: Optional[int]
    reasons: List[str]


# Core Decision Endpoint

@app.post("/decision", response_model=DecisionResponse)
def make_decision(train: TrainRequest, context: SystemContext):
    """
    Main RailSahayak Decision Engine
    Applies G&SR rules step-by-step
    """

    reasons = []

    # Emergency Gate (Highest Priority)
    emergency = emergency_mode_decision(context.disaster_active)
    if not emergency["optimization_allowed"]:
        return DecisionResponse(
            allow_movement=False,
            allowed_actions=emergency["allowed_actions"],
            max_speed=None,
            reasons=[emergency["reason"]]
        )

    # Signal Gate
    signal_result = check_signal_permission(
        train=train.train_id,
        signal_state=train.signal_state,
        has_written_authority=train.has_written_authority
    )

    if not signal_result["can_proceed"]:
        return DecisionResponse(
            allow_movement=False,
            allowed_actions=["HOLD"],
            max_speed=None,
            reasons=[signal_result["reason"]]
        )

    reasons.append(signal_result["reason"])

    # Block Gate
    block_result = check_block_entry(
        train_id=train.train_id,
        block_id=train.block_id,
        occupied_blocks=context.occupied_blocks
    )

    if not block_result["can_enter"]:
        return DecisionResponse(
            allow_movement=False,
            allowed_actions=["HOLD"],
            max_speed=None,
            reasons=[block_result["reason"]]
        )

    reasons.append(block_result["reason"])

    # Fouling Check (Safety)
    fouling_result = check_fouling(
        track_segment=train.block_id,
        fouling_segments=context.fouling_segments
    )

    if not fouling_result["safe"]:
        return DecisionResponse(
            allow_movement=False,
            allowed_actions=["HOLD"],
            max_speed=None,
            reasons=[fouling_result["reason"]]
        )

    reasons.append(fouling_result["reason"])

    # Speed Determination
    speed_result = determine_speed_limit(
        sectional_speed=train.sectional_speed,
        condition=train.condition,
        gradient=train.gradient
    )

    reasons.append(speed_result["reason"])

    # Final Allowed Actions
    allowed_actions = ["PROCEED", "HOLD", "MAINTAIN_SPEED", "DIVERT"]

    if speed_result["max_speed"] <= 30:
        allowed_actions.remove("PROCEED")

    return DecisionResponse(
        allow_movement=True,
        allowed_actions=allowed_actions,
        max_speed=speed_result["max_speed"],
        reasons=reasons
    )



# Health Check


@app.get("/health")
def health_check():
    return {"status": "RailSahayak API running"}
