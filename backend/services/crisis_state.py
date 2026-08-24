import time

from backend.database import get_client
from backend.services.decision_state import record_action

SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

CRISIS_TYPES: dict[str, dict] = {
    "NATURAL_DISASTER": {
        "label": "Natural Disaster",
        "is_disaster": True,
        "default_severity": "CRITICAL",
        "default_action": "Activate emergency mode – hold all trains",
    },
    "DERAILMENT": {
        "label": "Derailment",
        "is_disaster": True,
        "default_severity": "CRITICAL",
        "default_action": "Activate emergency mode – hold all trains",
    },
    "SIGNAL_FAILURE": {
        "label": "Signal Failure",
        "is_disaster": False,
        "default_severity": "HIGH",
        "default_action": "Restrict movement through affected block",
    },
    "TRACTION_FAILURE": {
        "label": "Traction Failure",
        "is_disaster": False,
        "default_severity": "HIGH",
        "default_action": "Dispatch relief; hold affected train",
    },
    "TRACK_OBSTRUCTION": {
        "label": "Track Obstruction",
        "is_disaster": False,
        "default_severity": "HIGH",
        "default_action": "Block line until obstruction cleared",
    },
    "FIRE": {
        "label": "Fire",
        "is_disaster": False,
        "default_severity": "CRITICAL",
        "default_action": "Evacuate and isolate affected area",
    },
    "CROSSING_ACCIDENT": {
        "label": "Level Crossing Accident",
        "is_disaster": False,
        "default_severity": "HIGH",
        "default_action": "Stop trains at adjacent crossings",
    },
}

_CATALOG_ORDER = [
    "NATURAL_DISASTER",
    "DERAILMENT",
    "SIGNAL_FAILURE",
    "TRACTION_FAILURE",
    "TRACK_OBSTRUCTION",
    "FIRE",
    "CROSSING_ACCIDENT",
]


def _to_dict(crisis) -> dict:
    return {
        "id": crisis.crisis_id,
        "type": crisis.type,
        "label": crisis.label,
        "is_disaster": crisis.is_disaster,
        "severity": crisis.severity,
        "location": crisis.location,
        "block_id": crisis.block_id,
        "description": crisis.description,
        "status": crisis.status,
        "declared_at": crisis.declared_at,
        "resolved_at": crisis.resolved_at,
    }


def _next_crisis_id() -> str:
    db = get_client()
    last = db.crisis.find_first(order={"id": "desc"})
    n = (last.id if last else 0) + 1
    return f"crisis-{n}"


def crisis_types() -> list[dict]:
    return [
        {**CRISIS_TYPES[t], "type": t}
        for t in _CATALOG_ORDER
        if t in CRISIS_TYPES
    ]


def disaster_active() -> bool:
    db = get_client()
    return db.crisis.find_first(
        where={"status": "ACTIVE", "is_disaster": True}
    ) is not None


def declare_crisis(
    crisis_type: str,
    severity: str | None,
    location: str,
    block_id: str | None,
    description: str | None,
) -> dict:
    meta = CRISIS_TYPES.get(crisis_type)
    if meta is None:
        raise ValueError(f"Unknown crisis type '{crisis_type}'")

    crisis_id = _next_crisis_id()
    db = get_client()
    crisis = db.crisis.create(
        data={
            "crisis_id": crisis_id,
            "type": crisis_type,
            "label": meta["label"],
            "is_disaster": meta["is_disaster"],
            "severity": severity or meta["default_severity"],
            "location": location,
            "block_id": block_id,
            "description": description or meta["default_action"],
            "status": "ACTIVE",
            "declared_at": time.strftime("%H:%M:%S"),
            "resolved_at": None,
        }
    )

    record_action(
        "crisis_declare",
        {
            "crisis_id": crisis.crisis_id,
            "type": crisis_type,
            "severity": crisis.severity,
            "location": location,
            "block_id": block_id,
            "description": crisis.description,
            "is_disaster": meta["is_disaster"],
        },
    )
    return _to_dict(crisis)


def resolve_crisis(crisis_id: str) -> dict | None:
    db = get_client()
    existing = db.crisis.find_unique(where={"crisis_id": crisis_id})
    if existing is None:
        return None

    resolved_at = time.strftime("%H:%M:%S")
    crisis = db.crisis.update(
        where={"crisis_id": crisis_id},
        data={"status": "RESOLVED", "resolved_at": resolved_at},
    )
    if crisis is None:
        return None

    record_action(
        "crisis_resolve",
        {
            "crisis_id": crisis_id,
            "type": crisis.type,
            "resolved_at": resolved_at,
        },
    )
    return _to_dict(crisis)


def list_crises() -> list[dict]:
    db = get_client()
    rows = db.crisis.find_many(order={"id": "desc"})
    return [_to_dict(row) for row in rows]


def active_crises() -> list[dict]:
    db = get_client()
    rows = db.crisis.find_many(
        where={"status": "ACTIVE"}, order={"id": "desc"}
    )
    return [_to_dict(row) for row in rows]
