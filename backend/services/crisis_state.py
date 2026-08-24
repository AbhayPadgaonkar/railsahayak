import time

from backend.services.decision_state import record_action

SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# Crisis catalog: each type knows its label, whether it is a line-wide
# disaster (forces the emergency rule across every /decision), and the
# default controller action.
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

_CRISES: list[dict] = []
_COUNTER = 0


def crisis_types() -> list[dict]:
    return [
        {**CRISIS_TYPES[t], "type": t}
        for t in _CATALOG_ORDER
        if t in CRISIS_TYPES
    ]


def disaster_active() -> bool:
    """True while a line-wide disaster crisis is active. The decision engine
    consults this so a declared disaster holds trains even if a caller did not
    set `disaster_active` in the request context."""
    return any(c["status"] == "ACTIVE" and c["is_disaster"] for c in _CRISES)


def declare_crisis(
    crisis_type: str,
    severity: str | None,
    location: str,
    block_id: str | None,
    description: str | None,
) -> dict:
    """Declare a crisis, log it to the audit trail, and return the record.

    `location` is a station id; `block_id` narrows the impact to a specific
    block inside that station (optional). Affected trains are computed live
    by the API layer via the sim."""
    meta = CRISIS_TYPES.get(crisis_type)
    if meta is None:
        raise ValueError(f"Unknown crisis type '{crisis_type}'")

    global _COUNTER
    _COUNTER += 1
    crisis = {
        "id": f"crisis-{_COUNTER}",
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
    _CRISES.append(crisis)

    record_action(
        "crisis_declare",
        {
            "crisis_id": crisis["id"],
            "type": crisis_type,
            "severity": crisis["severity"],
            "location": location,
            "block_id": block_id,
            "description": crisis["description"],
            "is_disaster": meta["is_disaster"],
        },
    )
    return crisis


def resolve_crisis(crisis_id: str) -> dict | None:
    for crisis in _CRISES:
        if crisis["id"] == crisis_id:
            crisis["status"] = "RESOLVED"
            crisis["resolved_at"] = time.strftime("%H:%M:%S")
            record_action(
                "crisis_resolve",
                {
                    "crisis_id": crisis_id,
                    "type": crisis["type"],
                    "resolved_at": crisis["resolved_at"],
                },
            )
            return crisis
    return None


def list_crises() -> list[dict]:
    """All crises, newest first."""
    return list(reversed(_CRISES))


def active_crises() -> list[dict]:
    return [c for c in _CRISES if c["status"] == "ACTIVE"]