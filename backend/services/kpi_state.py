import time
from dataclasses import asdict, dataclass
from typing import Dict, List

from backend.api.advisory import _build_advisories
from backend.services.decision_state import action_counts
from backend.services.section_sim import section_sim

MAX_HISTORY = 60


@dataclass
class KpiSnapshot:
    ts: str
    active_trains: int
    block_utilization_pct: float
    average_delay_min: float
    punctuality_pct: float
    throughput_trains_per_hour: float
    advisories: Dict[str, int]
    actions: Dict[str, int]


_HISTORY: List[KpiSnapshot] = []


def _now_iso() -> str:
    return time.strftime("%H:%M:%S")


def _compute_metrics() -> KpiSnapshot:
    total_blocks = len(section_sim.blocks)
    occupied = section_sim.occupied_lines()
    block_utilization_pct = (
        round(len(occupied) / total_blocks * 100, 1) if total_blocks else 0.0
    )

    delays = [
        float(entry.get("delay_min", 0) or 0)
        for entry in section_sim.schedule
    ]
    average_delay_min = round(sum(delays) / len(delays), 1) if delays else 0.0
    on_time = sum(1 for d in delays if d <= 0)
    punctuality_pct = round(on_time / len(delays) * 100, 1) if delays else 100.0

    elapsed_hours = section_sim._elapsed_min / 60.0
    throughput = (
        round(section_sim._completed_trains / elapsed_hours, 1)
        if elapsed_hours > 0
        else 0.0
    )

    advisories = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    try:
        for advisory in _build_advisories():
            advisories[advisory.priority] = advisories.get(advisory.priority, 0) + 1
    except Exception:
        pass

    counts = action_counts()
    actions = {
        "accept": counts.get("advisory_accept", 0),
        "dismiss": counts.get("advisory_dismiss", 0),
        "total": sum(counts.values()),
    }

    return KpiSnapshot(
        ts=_now_iso(),
        active_trains=len(section_sim.trains),
        block_utilization_pct=block_utilization_pct,
        average_delay_min=average_delay_min,
        punctuality_pct=punctuality_pct,
        throughput_trains_per_hour=throughput,
        advisories=advisories,
        actions=actions,
    )


def record_snapshot() -> KpiSnapshot:
    snapshot = _compute_metrics()
    _HISTORY.append(snapshot)
    if len(_HISTORY) > MAX_HISTORY:
        _HISTORY.pop(0)
    return snapshot


def get_history() -> List[dict]:
    return [asdict(s) for s in _HISTORY]


def current() -> KpiSnapshot:
    if not _HISTORY:
        return record_snapshot()
    return _HISTORY[-1]
