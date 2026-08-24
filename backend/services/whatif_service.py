from types import SimpleNamespace

from backend.domain.trains import TrainType, build_train_profile
from backend.ml.delay_predictor import DelayPredictor
from backend.ml.feature_builder import build_delay_features
from backend.rules.signals import check_signal_permission
from backend.rules.speed import determine_speed_limit
from backend.services.decision_state import record_action

SCENARIOS: dict[str, dict] = {
    "FOG": {
        "label": "Fog / poor visibility",
        "description": "Caution orders cap speed to 60 km/h; delay model adds a fog penalty.",
    },
    "STORM": {
        "label": "Storm",
        "description": "Safety instructions cap speed to 40 km/h.",
    },
    "SPEED_RESTRICTION": {
        "label": "Temporary speed restriction",
        "description": "Cap the sectional speed to a specific value, e.g. caution orders.",
    },
    "GRADIENT": {
        "label": "Gradient / ghat section",
        "description": "Apply an UP/DOWN gradient to the block; steep gradients carry heavy speed cuts.",
    },
    "HOLD": {
        "label": "Hold (congestion / authority)",
        "description": "Force a red-signal hold and add the waiting delay impact.",
    },
    "PRIORITY_PASS": {
        "label": "Priority pass (downgrade)",
        "description": "Reclassify the train to a low-priority class; predicted delay rises accordingly.",
    },
}


def scenario_options() -> list[dict]:
    return [
        {"id": sid, "label": spec["label"], "description": spec["description"]}
        for sid, spec in SCENARIOS.items()
    ]


def _block_transit_delta(base_speed: int, scen_speed: int) -> float:
    """Extra minutes to clear one 4 km block at the reduced speed."""
    if base_speed <= 0 or scen_speed >= base_speed:
        return 0.0
    if scen_speed <= 0:
        return float("inf")
    base_min = (4.0 * 60) / base_speed
    scen_min = (4.0 * 60) / scen_speed
    return max(0.0, scen_min - base_min)


def _features(
    train_type: str,
    sectional_speed: int,
    condition: str | None,
    gradient: dict | None,
) -> dict:
    profile = build_train_profile(
        train_id="",
        train_type=TrainType[train_type],
        max_speed=sectional_speed,
    )
    g = (
        SimpleNamespace(value=gradient["value"], direction=gradient["direction"])
        if gradient
        else None
    )
    return build_delay_features(profile, g, condition=condition)


def _predicted_delay(
    train_type: str,
    sectional_speed: int,
    condition: str | None,
    gradient: dict | None,
) -> float:
    return round(
        DelayPredictor().predict(
            _features(train_type, sectional_speed, condition, gradient)
        ),
        1,
    )


def _speed_verdict(
    sectional_speed: int, condition: str | None, gradient: dict | None
) -> dict:
    g = (
        SimpleNamespace(value=gradient["value"], direction=gradient["direction"])
        if gradient
        else None
    )
    res = determine_speed_limit(
        sectional_speed=sectional_speed,
        condition=condition,
        gradient=g,
        signal_mode="NORMAL",
    )
    return {"max_speed": res["max_speed"], "reason": res["reason"]}


def run_scenario(
    train_id: str,
    train_type: str,
    block_id: str,
    line_id: str,
    sectional_speed: int,
    scenario_type: str,
    parameter: float | None = None,
    direction: str = "UP",
    scheduled_time: int = 1000,
    current_time: int = 1000,
    gradient: dict | None = None,
    condition: str | None = None,
) -> dict:
    """Simulate a what-if: compare baseline vs a perturbed run of one train.

    Uses the shared delay predictor (ML) for projected delay and the G&SR
    speed/signal rules for the movement verdict."""

    scen_cond = condition
    scen_grad = gradient
    scen_speed = sectional_speed

    if scenario_type == "FOG":
        scen_cond = "FOG"
    elif scenario_type == "STORM":
        scen_cond = "STORM"
    elif scenario_type == "SPEED_RESTRICTION":
        scen_speed = min(sectional_speed, int(parameter or 0) or 30)
    elif scenario_type == "GRADIENT":
        scen_grad = {"value": int(parameter or 150), "direction": direction}
    elif scenario_type == "HOLD":
        pass

    base_type = train_type
    scen_type = train_type
    if scenario_type == "PRIORITY_PASS":
        # Downgrade: model the train as a low-priority class so the delay
        # predictor reflects inferior precedence in the section.
        scen_type = "GOODS"
        if scen_type == train_type:
            scen_type = "PASSENGER"

    base_delay = _predicted_delay(base_type, sectional_speed, condition, gradient)
    scen_delay = _predicted_delay(scen_type, scen_speed, scen_cond, scen_grad)

    if scenario_type == "HOLD":
        scen_delay = round(scen_delay + int(parameter or 15), 1)

    base_verdict = _speed_verdict(sectional_speed, condition, gradient)
    scen_verdict = _speed_verdict(scen_speed, scen_cond, scen_grad)

    scen_blocked = False
    scen_reason = scen_verdict["reason"]
    base_reason = base_verdict["reason"]
    scen_max = scen_verdict["max_speed"]

    if scenario_type == "HOLD":
        signal = check_signal_permission(
            train=train_id, signal_state="RED", has_written_authority=False
        )
        scen_blocked = not signal["can_proceed"]
        scen_reason = f"{scen_verdict['reason']} | {signal['reason']}"
        scen_max = None if scen_blocked else scen_verdict["max_speed"]

    delta = round(scen_delay - base_delay, 1)

    transit_impact = round(
        _block_transit_delta(sectional_speed, scen_speed), 1
    )

    record_action(
        "whatif_run",
        {
            "train_id": train_id,
            "scenario_type": scenario_type,
            "parameter": parameter,
            "scenario_label": SCENARIOS[scenario_type]["label"],
            "baseline_delay_min": base_delay,
            "scenario_delay_min": scen_delay,
            "delta_min": delta,
        },
    )

    return {
        "scenario_type": scenario_type,
        "scenario_label": SCENARIOS[scenario_type]["label"],
        "scenario_description": SCENARIOS[scenario_type]["description"],
        "train": {
            "train_id": train_id,
            "train_type": scen_type if scenario_type == "PRIORITY_PASS" else train_type,
            "block_id": block_id,
            "line_id": line_id,
        },
        "predicted_delay": {
            "baseline_min": base_delay,
            "scenario_min": scen_delay,
            "delta_min": delta,
        },
        "transit_impact_min": transit_impact,
        "movement": {
            "baseline": {
                "allowed": True,
                "max_speed": base_verdict["max_speed"],
                "reason": base_reason,
            },
            "scenario": {
                "allowed": not scen_blocked,
                "max_speed": scen_max,
                "reason": scen_reason,
            },
        },
        "outcome": "HOLD" if scen_blocked else "RELEASE",
    }