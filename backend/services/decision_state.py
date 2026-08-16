import time
from typing import Dict, List

TTL_SECONDS = 180.0

_ACTIVE: Dict[str, dict] = {}
_ACTIONS: List[dict] = []


def record_action(action: str, detail: dict):
    _ACTIONS.append(
        {
            "action": action,
            "detail": detail,
            "at": time.strftime("%H:%M:%S"),
        }
    )
    if len(_ACTIONS) > 200:
        _ACTIONS[:] = _ACTIONS[-200:]


def recent_actions(limit: int = 50) -> List[dict]:
    return _ACTIONS[-limit:]


def record_decision(
    train_id: str,
    block_id: str,
    line_id: str,
    allow_movement: bool,
    max_speed,
    signal_state: str,
):
    _ACTIVE[train_id] = {
        "train_id": train_id,
        "block_id": block_id,
        "line_id": line_id,
        "allow_movement": allow_movement,
        "max_speed": max_speed,
        "signal_state": signal_state,
        "updated_at": time.monotonic(),
    }


def active_decisions() -> List[dict]:
    now = time.monotonic()
    stale = [k for k, d in _ACTIVE.items() if now - d["updated_at"] > TTL_SECONDS]
    for k in stale:
        _ACTIVE.pop(k, None)
    return [d for k, d in _ACTIVE.items() if k not in stale]