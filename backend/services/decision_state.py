import time

from prisma import Json

from backend.database import get_client

TTL_SECONDS = 180.0


def record_action(action: str, detail: dict):
    db = get_client()
    db.auditaction.create(
        data={
            "action": action,
            "detail": Json(detail),
            "at": time.strftime("%H:%M:%S"),
        }
    )
    _prune_old_actions()


def _prune_old_actions():
    db = get_client()
    total = db.auditaction.count()
    if total > 200:
        ids = [
            row.id
            for row in db.auditaction.find_many(
                take=(total - 200), order={"id": "asc"}
            )
        ]
        if ids:
            db.auditaction.delete_many(where={"id": {"in": ids}})


def recent_actions(limit: int = 50) -> list[dict]:
    db = get_client()
    rows = db.auditaction.find_many(take=limit, order={"id": "desc"})
    return [
        {
            "action": row.action,
            "detail": row.detail,
            "at": row.at,
        }
        for row in reversed(rows)
    ]


def action_counts() -> dict[str, int]:
    db = get_client()
    rows = db.auditaction.find_many()
    counts: dict[str, int] = {}
    for row in rows:
        counts[row.action] = counts.get(row.action, 0) + 1
    return counts


def record_decision(
    train_id: str,
    block_id: str,
    line_id: str,
    allow_movement: bool,
    max_speed,
    signal_state: str,
):
    db = get_client()
    updated_at = time.time()
    db.decision.upsert(
        where={"train_id": train_id},
        data={
            "create": {
                "train_id": train_id,
                "block_id": block_id,
                "line_id": line_id,
                "allow_movement": allow_movement,
                "max_speed": max_speed,
                "signal_state": signal_state,
                "updated_at": updated_at,
            },
            "update": {
                "block_id": block_id,
                "line_id": line_id,
                "allow_movement": allow_movement,
                "max_speed": max_speed,
                "signal_state": signal_state,
                "updated_at": updated_at,
            },
        },  # type: ignore[typeddict-item]
    )


def active_decisions() -> list[dict]:
    now = time.time()
    cutoff = now - TTL_SECONDS
    db = get_client()
    rows = db.decision.find_many(where={"updated_at": {"gt": cutoff}})
    return [
        {
            "train_id": row.train_id,
            "block_id": row.block_id,
            "line_id": row.line_id,
            "allow_movement": row.allow_movement,
            "max_speed": row.max_speed,
            "signal_state": row.signal_state,
            "updated_at": row.updated_at,
        }
        for row in rows
    ]
