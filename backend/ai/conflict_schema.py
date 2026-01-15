from enum import Enum
from typing import List
from dataclasses import dataclass


class ConflictType(Enum):
    BLOCK_CONTENTION = "BLOCK_CONTENTION"
    CROSSING_CONFLICT = "CROSSING_CONFLICT"
    OVERTAKE_CONFLICT = "OVERTAKE_CONFLICT"
    GRADIENT_RISK = "GRADIENT_RISK"
    PLATFORM_CONFLICT = "PLATFORM_CONFLICT"


class RiskLevel(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


@dataclass
class Conflict:
    conflict_type: ConflictType
    risk_level: RiskLevel
    affected_trains: List[str]
    description: str
    suggested_strategies: List[str]
