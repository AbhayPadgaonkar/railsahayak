from typing import List, Dict
from backend.ai.conflict_schema import Conflict, ConflictType, RiskLevel
from backend.domain.trains import TrainProfile


def detect_conflicts(
    train_profiles: List[TrainProfile],
    intended_blocks: Dict[str, str],  # train_id → next_block
    gradients: Dict[str, dict],        # block_id → gradient metadata
):
    conflicts: List[Conflict] = []

    # 1️⃣ BLOCK CONTENTION
    block_usage = {}
    for train_id, block_id in intended_blocks.items():
        block_usage.setdefault(block_id, []).append(train_id)

    for block_id, trains in block_usage.items():
        if len(trains) > 1:
            conflicts.append(
                Conflict(
                    conflict_type=ConflictType.BLOCK_CONTENTION,
                    risk_level=RiskLevel.HIGH,
                    affected_trains=trains,
                    description=f"Multiple trains competing for block {block_id}",
                    suggested_strategies=["PRIORITY_ORDER", "HOLD_LOWER_PRIORITY"],
                )
            )

    # 2️⃣ GRADIENT RISK (goods on steep gradient)
    for profile in train_profiles:
        block = intended_blocks.get(profile.train_id)
        gradient = gradients.get(block)

        if (
            gradient
            and gradient["value"] <= 200
            and profile.train_type.name == "GOODS"
        ):
            conflicts.append(
                Conflict(
                    conflict_type=ConflictType.GRADIENT_RISK,
                    risk_level=RiskLevel.MEDIUM,
                    affected_trains=[profile.train_id],
                    description="Goods train approaching steep gradient",
                    suggested_strategies=["AVOID_STOP", "PRIORITY_PASS"],
                )
            )

    # 3️⃣ CROSSING CONFLICT (goods vs high-priority)
    sorted_trains = sorted(train_profiles, key=lambda x: x.priority)
    for i in range(len(sorted_trains) - 1):
        t1 = sorted_trains[i]
        t2 = sorted_trains[i + 1]

        if t1.train_type.name != t2.train_type.name:
            conflicts.append(
                Conflict(
                    conflict_type=ConflictType.CROSSING_CONFLICT,
                    risk_level=RiskLevel.MEDIUM,
                    affected_trains=[t1.train_id, t2.train_id],
                    description="Potential crossing delay between trains of unequal priority",
                    suggested_strategies=["PASS_HIGH_PRIORITY", "HOLD_LOW_PRIORITY"],
                )
            )

    return conflicts
