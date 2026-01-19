from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

from backend.rules.signals import check_signal_permission
from backend.rules.tracks import check_line_entry, check_fouling
from backend.rules.speed import determine_speed_limit
from backend.rules.emergency import emergency_mode_decision

from backend.api.sensors_api import router as sensor_router
from backend.domain.trains import TrainType, build_train_profile
from backend.optimizer.section_optimizer import optimize_train_order



app = FastAPI(
    title="RailSahayak Decision API",
    description="G&SR-compliant railway decision support system",
    version="1.0.0",
)

app.include_router(sensor_router)

delay_predictor = DelayPredictor()


class Gradient(BaseModel):
    value: int
    direction: str


class TrainRequest(BaseModel):
    train_id: str
    train_type: str
    block_id: str
    line_id: str
    signal_state: str
    sectional_speed: int

    scheduled_time: int        # minutes since midnight
    current_time: int          # minutes since midnight

    gradient: Optional[Gradient] = None
    condition: Optional[str] = None
    has_written_authority: bool = False




class SystemContext(BaseModel):
    occupied_lines: List[str]     
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

class OptimizedOrder(BaseModel):
    train_id: str
    order: int


class SectionDecisionResponse(BaseModel):
    decisions: List[DecisionResponse]
    optimized_order: Optional[List[OptimizedOrder]] = None



@app.post("/decision", response_model=SectionDecisionResponse)
def make_decision(payload: SectionDecisionRequest):
    optimizer_input = []
    results = []
    
    def compute_current_delay(train: TrainRequest) -> int:
        return max(0, train.current_time - train.scheduled_time)

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
        return SectionDecisionResponse(
            decisions=results,
            optimized_order=None,
        )

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

        line_result = check_line_entry(
        train_id=train.train_id,
        line_id=train.line_id,
        occupied_lines=payload.context.occupied_lines,
    )

        if not line_result["can_enter"]:
            results.append(
                DecisionResponse(
                    train_id=train.train_id,
                    allow_movement=False,
                    allowed_actions=["HOLD"],
                    max_speed=None,
                    reasons=[line_result["reason"]],
                )
            )
            continue
        reasons.append(line_result["reason"])

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

        current_delay = compute_current_delay(train)


        speed_result = determine_speed_limit(
            sectional_speed=train.sectional_speed,
            condition=train.condition,
            gradient=train.gradient,
        )
        reasons.append(speed_result["reason"])

        allowed_actions = ["PROCEED", "HOLD", "MAINTAIN_SPEED", "DIVERT"]
        if speed_result["max_speed"] <= 30:
            allowed_actions.remove("PROCEED")

        optimizer_input.append(
            {
                "train_id": train.train_id,
                "priority": profile.priority,
                "current_delay": current_delay,
                "block_id": train.block_id,
                "line_id": train.line_id,
                "train_type": train.train_type,
                "gradient": train.gradient.dict() if train.gradient else None,
            }
        )



        results.append(
            DecisionResponse(
                train_id=train.train_id,
                allow_movement=True,
                allowed_actions=allowed_actions,
                max_speed=speed_result["max_speed"],
                reasons=reasons,
            )
        )

    optimized_order = []

    block_groups = {}
    for item in optimizer_input:
        block_groups.setdefault(item["block_id"], []).append(item)

    for trains_in_block in block_groups.values():

        # Group further by line
        line_groups = {}
        for t in trains_in_block:
            line_groups.setdefault(t["line_id"], []).append(t)

        for trains_in_line in line_groups.values():

            # 🔒 GUARD: optimize ONLY if real contention exists
            if len(trains_in_line) <= 1:
                continue

            optimized = optimize_train_order(trains_in_line)
            if optimized:
                optimized_order.extend(
                    OptimizedOrder(train_id=t["train_id"], order=i)
                    for i, t in enumerate(optimized)
                )
    return SectionDecisionResponse(
        decisions=results,
        optimized_order=optimized_order if optimized_order else None
    )





@app.get("/health")
def health_check():
    return {"status": "RailSahayak API running"}
