from typing import List, Optional

from fastapi import HTTPException
from pydantic import BaseModel

from backend.rules.signals import check_signal_permission
from backend.rules.tracks import check_line_entry, check_fouling
from backend.rules.speed import determine_speed_limit
from backend.rules.emergency import emergency_mode_decision
from backend.rules.turnouts import check_turnout_conflict
from backend.domain.trains import TrainType, build_train_profile
from backend.optimizer.section_optimizer import optimize_train_order
from backend.services.route_service import RouteService
from backend.services.decision_state import record_decision, record_action

route_service = RouteService(section_id="section_A")


class Gradient(BaseModel):
    value: int
    direction: str


class TrainRequest(BaseModel):
    train_id: str
    train_type: str

    block_id: str
    line_id: str
    next_block_id: Optional[str] = None

    signal_state: str
    sectional_speed: int

    scheduled_time: int
    current_time: int

    gradient: Optional[Gradient] = None
    condition: Optional[str] = None
    has_written_authority: bool = False


class SystemContext(BaseModel):
    occupied_lines: List[str]
    occupied_turnouts: List[str]
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
    reason: Optional[str] = None


class SectionDecisionResponse(BaseModel):
    decisions: List[DecisionResponse]
    optimized_order: Optional[List[OptimizedOrder]] = None


def _log_decision_run(results: List[DecisionResponse], optimized_order=None):
    """Record an audit trail entry for a completed /decision run."""
    record_action(
        "decision_run",
        {
            "trains": [
                {
                    "train_id": r.train_id,
                    "allow_movement": r.allow_movement,
                    "max_speed": r.max_speed,
                    "allowed_actions": r.allowed_actions,
                }
                for r in results
            ],
            "optimized_order": optimized_order,
        },
    )


def make_decision(payload: SectionDecisionRequest) -> SectionDecisionResponse:
    optimizer_input = []
    results = []

    def compute_current_delay(train: TrainRequest) -> int:
        return max(0, train.current_time - train.scheduled_time)

    def persist(train: TrainRequest, allow: bool, max_speed):
        record_decision(
            train_id=train.train_id,
            block_id=train.block_id,
            line_id=train.line_id,
            allow_movement=allow,
            max_speed=max_speed,
            signal_state=train.signal_state,
        )

    emergency = emergency_mode_decision(payload.context.disaster_active)
    if not emergency["optimization_allowed"]:
        for train in payload.trains:
            record_decision(
                train_id=train.train_id,
                block_id=train.block_id,
                line_id=train.line_id,
                allow_movement=False,
                max_speed=None,
                signal_state=train.signal_state,
            )
            results.append(
                DecisionResponse(
                    train_id=train.train_id,
                    allow_movement=False,
                    allowed_actions=emergency["allowed_actions"],
                    max_speed=None,
                    reasons=[emergency["reason"]],
                )
            )
        _log_decision_run(results)
        return SectionDecisionResponse(decisions=results, optimized_order=None)

    for train in payload.trains:
        reasons = []

        if train.train_type not in TrainType.__members__:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Unknown train_type '{train.train_type}' for train "
                    f"'{train.train_id}'. Valid: {', '.join(TrainType.__members__)}"
                ),
            )

        signal_result = check_signal_permission(
            train=train.train_id,
            signal_state=train.signal_state,
            has_written_authority=train.has_written_authority,
        )
        if not signal_result["can_proceed"]:
            persist(train, False, None)
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
            block_id=train.block_id,
            line_id=train.line_id,
            occupied_lines=payload.context.occupied_lines,
        )
        if not line_result["can_enter"]:
            persist(train, False, None)
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

        turnout_result = check_turnout_conflict(
            train_id=train.train_id,
            block_id=train.block_id,
            line_id=train.line_id,
            occupied_turnouts=payload.context.occupied_turnouts,
            route_service=route_service,
        )
        if not turnout_result["can_proceed"]:
            persist(train, False, None)
            results.append(
                DecisionResponse(
                    train_id=train.train_id,
                    allow_movement=False,
                    allowed_actions=["HOLD"],
                    max_speed=None,
                    reasons=[turnout_result["reason"]],
                )
            )
            continue

        for t in turnout_result.get("required_turnouts", []):
            if t not in payload.context.occupied_turnouts:
                payload.context.occupied_turnouts.append(t)
        reasons.append(turnout_result["reason"])

        fouling_result = check_fouling(
            track_segment=train.block_id,
            fouling_segments=payload.context.fouling_segments,
        )
        if not fouling_result["safe"]:
            persist(train, False, None)
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
            signal_mode=signal_result["speed_mode"],
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

        persist(train, True, speed_result["max_speed"])

        results.append(
            DecisionResponse(
                train_id=train.train_id,
                allow_movement=True,
                allowed_actions=allowed_actions,
                max_speed=speed_result["max_speed"],
                reasons=reasons,
            )
        )

        if "PROCEED" in allowed_actions and train.next_block_id:
            current_key = f"{train.block_id}|{train.line_id}"
            next_key = f"{train.next_block_id}|{train.line_id}"

            if current_key in payload.context.occupied_lines:
                payload.context.occupied_lines.remove(current_key)

            if next_key not in payload.context.occupied_lines:
                payload.context.occupied_lines.append(next_key)

    optimized_order = []

    block_groups = {}
    for item in optimizer_input:
        block_groups.setdefault(item["block_id"], []).append(item)

    for trains_in_block in block_groups.values():
        line_groups = {}
        for t in trains_in_block:
            line_groups.setdefault(t["line_id"], []).append(t)

        for trains_in_line in line_groups.values():
            if len(trains_in_line) <= 1:
                continue
            optimized = optimize_train_order(trains_in_line)
            if optimized:
                optimized_order.extend(
                    OptimizedOrder(
                        train_id=t["train_id"],
                        order=i,
                        reason=_order_rationale(t),
                    )
                    for i, t in enumerate(optimized)
                )

    _log_decision_run(
        results,
        optimized_order=[o.dict() for o in optimized_order] if optimized_order else None,
    )
    return SectionDecisionResponse(
        decisions=results,
        optimized_order=optimized_order if optimized_order else None,
    )


def _order_rationale(t: dict) -> str:
    gradient = t.get("gradient")
    if (
        t["train_type"] == "GOODS"
        and gradient
        and gradient["direction"] == "UP"
        and gradient["value"] <= 200
    ):
        return "Goods-first clearance on steep UP gradient (Ghat rule)"
    return "Priority precedence per IR train class"