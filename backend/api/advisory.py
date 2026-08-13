from types import SimpleNamespace
from typing import List, Optional

from fastapi import APIRouter, Query

from backend.ai.conflict_detector import detect_conflicts
from backend.domain.trains import TrainType, build_train_profile
from backend.ml.delay_predictor import DelayPredictor
from backend.ml.feature_builder import build_delay_features
from pydantic import BaseModel

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
        "gradient_value": None,
        "condition": None,
    },
    {
        "train_id": "RAJ1",
        "train_type": "RAJDHANI",
        "sectional_speed": 110,
        "block_id": "A_B",
        "gradient_value": None,
        "condition": None,
    },
    {
        "train_id": "G3",
        "train_type": "GOODS",
        "sectional_speed": 75,
        "block_id": "A_B",
        "gradient_value": 150,
        "condition": None,
    },
    {
        "train_id": "P5",
        "train_type": "PASSENGER",
        "sectional_speed": 90,
        "block_id": "B_C",
        "gradient_value": None,
        "condition": None,
    },
]

_GRADIENTS = {
    "A_B": {"value": 150, "direction": "UP"},
    "B_C": {"value": 300, "direction": "UP"},
    "C_D": {"value": 400, "direction": "DOWN"},
}


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

    return AdvisoryResponse(advisories=advisories)


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
