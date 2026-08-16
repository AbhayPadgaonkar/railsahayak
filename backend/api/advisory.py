from types import SimpleNamespace
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.ai.conflict_detector import detect_conflicts
from backend.domain.trains import TrainType, build_train_profile
from backend.ml.delay_predictor import DelayPredictor
from backend.ml.feature_builder import build_delay_features
from backend.services.decision_service import (
    Gradient,
    SectionDecisionRequest,
    SectionDecisionResponse,
    SystemContext,
    TrainRequest as DecisionTrainRequest,
    make_decision,
)
from backend.services.decision_state import record_action

router = APIRouter()

predictor = DelayPredictor()


class DelayPrediction(BaseModel):
    train_id: str
    train_type: str
    predicted_delay_min: float


class Advisory(BaseModel):
    id: str
    title: str
    priority: str
    location: str
    duration: str
    description: str
    affected_trains: List[str]
    strategies: List[str]


class AdvisoryResponse(BaseModel):
    advisories: List[Advisory]


STRATEGY_LABELS = {
    "PRIORITY_ORDER": "Apply Priority Ordering",
    "HOLD_LOWER_PRIORITY": "Hold Lower-Priority Train",
    "HOLD_LOW_PRIORITY": "Hold Low-Priority Train",
    "AVOID_STOP": "Avoid Stopping on Gradient",
    "PRIORITY_PASS": "Give Priority Pass",
    "PASS_HIGH_PRIORITY": "Pass High-Priority Train",
}

# Representative trains for SECTION_A (no live train store yet)
_ROSTER = [
    {
        "train_id": "VB2",
        "train_type": "VANDE_BHARAT",
        "sectional_speed": 130,
        "block_id": "C_D",
        "line_id": "UP_MAIN",
        "gradient_value": None,
        "condition": None,
    },
    {
        "train_id": "RAJ1",
        "train_type": "RAJDHANI",
        "sectional_speed": 110,
        "block_id": "A_B",
        "line_id": "UP_MAIN",
        "gradient_value": None,
        "condition": None,
    },
    {
        "train_id": "G3",
        "train_type": "GOODS",
        "sectional_speed": 75,
        "block_id": "A_B",
        "line_id": "UP_MAIN",
        "gradient_value": 150,
        "condition": None,
    },
    {
        "train_id": "P5",
        "train_type": "PASSENGER",
        "sectional_speed": 90,
        "block_id": "B_C",
        "line_id": "UP_MAIN",
        "gradient_value": None,
        "condition": None,
    },
]

_GRADIENTS = {
    "A_B": {"value": 150, "direction": "UP"},
    "B_C": {"value": 300, "direction": "UP"},
    "C_D": {"value": 400, "direction": "DOWN"},
}

# block -> next block within the section (for decision requests)
_NEXT_BLOCK = {"A_B": "B_C", "B_C": "C_D", "C_D": None}


@router.get("/predict-delay", response_model=DelayPrediction)
def predict_delay(
    train_id: str = Query(default="T"),
    train_type: str = Query(default="PASSENGER"),
    sectional_speed: int = Query(default=100),
    gradient_value: Optional[int] = Query(default=None),
    condition: Optional[str] = Query(default=None),
):
    profile = build_train_profile(
        train_id=train_id,
        train_type=TrainType[train_type],
        max_speed=sectional_speed,
    )
    gradient = (
        SimpleNamespace(value=gradient_value) if gradient_value is not None else None
    )
    features = build_delay_features(profile, gradient, condition=condition)
    delay = predictor.predict(features)
    return DelayPrediction(
        train_id=train_id,
        train_type=train_type,
        predicted_delay_min=round(delay, 1),
    )


@router.get("/advisory", response_model=AdvisoryResponse)
def get_advisories():
    advisories = _build_advisories()
    return AdvisoryResponse(advisories=advisories)


def _build_advisories() -> List[Advisory]:
    profiles = []
    intended_blocks = {}
    gradients = {}

    for entry in _ROSTER:
        profile = build_train_profile(
            train_id=entry["train_id"],
            train_type=TrainType[entry["train_type"]],
            max_speed=entry["sectional_speed"],
        )
        profiles.append(profile)
        intended_blocks[entry["train_id"]] = entry["block_id"]
        gradients[entry["block_id"]] = _GRADIENTS[entry["block_id"]]

    conflicts = detect_conflicts(
        train_profiles=profiles,
        intended_blocks=intended_blocks,
        gradients=gradients,
    )

    advisories = []
    for i, conflict in enumerate(conflicts):
        primary = conflict.affected_trains[0]
        block = intended_blocks.get(primary, "SECTION_A")

        delay = predict_delay(
            train_id=primary,
            train_type=_train_type_of(profiles, primary),
            sectional_speed=_speed_of(profiles, primary),
            gradient_value=_GRADIENTS.get(block, {}).get("value"),
        ).predicted_delay_min

        title = STRATEGY_LABELS.get(
            conflict.suggested_strategies[0]
            if conflict.suggested_strategies
            else "",
            conflict.conflict_type.value,
        )
        location = ", ".join(
            dict.fromkeys(intended_blocks.get(t, block) for t in conflict.affected_trains)
        )
        description = (
            f"{conflict.description} (trains: {', '.join(conflict.affected_trains)}). "
            f"Recommended: {', '.join(conflict.suggested_strategies) or 'monitor'}."
        )

        advisories.append(
            Advisory(
                id=f"advisory-{i + 1}",
                title=title,
                priority=conflict.risk_level.value,
                location=location,
                duration=f"≈ {delay:.0f} mins predicted delay" if delay > 0 else "Ongoing",
                description=description,
                affected_trains=conflict.affected_trains,
                strategies=conflict.suggested_strategies,
            )
        )

    return advisories


def _train_type_of(profiles, train_id: str) -> str:
    for p in profiles:
        if p.train_id == train_id:
            return p.train_type.name
    return "PASSENGER"


def _speed_of(profiles, train_id: str) -> int:
    for p in profiles:
        if p.train_id == train_id:
            return p.max_permissible_speed
    return 100


# ---------- apply / dismiss ----------


class AdvisoryActionRequest(BaseModel):
    advisory_id: str
    action: str  # "accept" | "dismiss"


class AdvisoryActionResponse(BaseModel):
    advisory_id: str
    action: str
    applied: bool
    decision: Optional[SectionDecisionResponse] = None


_PASS_OR_HOLD_STRATEGIES = {
    "HOLD_LOWER_PRIORITY",
    "HOLD_LOW_PRIORITY",
    "PRIORITY_PASS",
    "PASS_HIGH_PRIORITY",
}


def _roster(affected_trains: List[str]) -> dict:
    return {e["train_id"]: e for e in _ROSTER if e["train_id"] in affected_trains}


def _train_priority(train_id: str) -> int:
    entry = next((e for e in _ROSTER if e["train_id"] == train_id), None)
    if not entry:
        return 99
    profile = build_train_profile(
        train_id=entry["train_id"],
        train_type=TrainType[entry["train_type"]],
        max_speed=entry["sectional_speed"],
    )
    return profile.priority


def _build_apply_request(advisory: Advisory) -> SectionDecisionRequest:
    entries = _roster(advisory.affected_trains)
    strategies = set(advisory.strategies)

    signals = {tid: "GREEN" for tid in entries}
    # Only multi-train advisories (block contention / crossing conflicts)
    # legitimately hold a train. AVOID_STOP / PRIORITY_PASS on a lone goods
    # train mean "keep it rolling", not "hold it".
    if len(entries) > 1 and strategies & _PASS_OR_HOLD_STRATEGIES:
        lowest = max(entries, key=lambda tid: _train_priority(tid))
        signals[lowest] = "RED"

    trains = []
    for tid, entry in entries.items():
        gradient = None
        g = _GRADIENTS.get(entry["block_id"])
        if g:
            gradient = Gradient(value=g["value"], direction=g["direction"])
        trains.append(
            DecisionTrainRequest(
                train_id=tid,
                train_type=entry["train_type"],
                block_id=entry["block_id"],
                line_id=entry["line_id"],
                next_block_id=_NEXT_BLOCK.get(entry["block_id"]),
                signal_state=signals[tid],
                sectional_speed=entry["sectional_speed"],
                scheduled_time=1000,
                current_time=1000,
                gradient=gradient,
                condition=entry.get("condition"),
                has_written_authority=False,
            )
        )

    return SectionDecisionRequest(
        trains=trains,
        context=SystemContext(
            occupied_lines=[],
            occupied_turnouts=[],
            fouling_segments=[],
            disaster_active=False,
        ),
    )


@router.post("/advisory/apply", response_model=AdvisoryActionResponse)
def apply_advisory(payload: AdvisoryActionRequest):
    advisories = {a.id: a for a in _build_advisories()}
    advisory = advisories.get(payload.advisory_id)
    if not advisory:
        raise HTTPException(status_code=404, detail=f"Unknown advisory '{payload.advisory_id}'")

    if payload.action == "dismiss":
        record_action("advisory_dismiss", {"advisory_id": advisory.id})
        return AdvisoryActionResponse(
            advisory_id=advisory.id,
            action="dismiss",
            applied=True,
        )

    if payload.action != "accept":
        raise HTTPException(status_code=422, detail="action must be 'accept' or 'dismiss'")

    request = _build_apply_request(advisory)
    decision = make_decision(request)
    record_action(
        "advisory_accept",
        {
            "advisory_id": advisory.id,
            "trains": [d.train_id for d in decision.decisions],
        },
    )
    return AdvisoryActionResponse(
        advisory_id=advisory.id,
        action="accept",
        applied=True,
        decision=decision,
    )
