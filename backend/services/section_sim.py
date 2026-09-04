import json
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from backend.engine.train_movement import advance_train
from backend.services.decision_state import active_decisions

BLOCK_LENGTH_KM = 4.0
TIME_SCALE = 0.5  # real seconds -> sim minutes (loop mode only)

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
YARDS_DIR = CONFIG_DIR / "yards"
TIMETABLES_DIR = CONFIG_DIR / "timetables"


@dataclass
class SimStop:
    block_id: str
    dwell_min: float


@dataclass
class SimTrain:
    train_id: str
    block_id: str
    line_id: str
    position: float  # 0.0 = start of block, 1.0 = clear
    speed_kmph: int
    train_type: str = "PASSENGER"
    stops: list[SimStop] = field(default_factory=list)
    _dwelled: set[str] = field(default_factory=set)
    _dwell_remaining: float = 0.0


def _hhmm_to_minutes(t: str) -> int:
    """Convert 'HH:MM' to minutes since midnight."""
    h, m = t.split(":")
    return int(h) * 60 + int(m)


class SectionSim:
    """In-memory live section driven by a JSON timetable.

    Supports two modes controlled by the timetable's ``mode`` field:

    **loop** (default):
        Trains spawn when the sim clock reaches their entry_min.  The
        schedule loops so the map stays live indefinitely.

    **realtime**:
        The sim clock is wall-clock time (system time).  Trains are
        scheduled by HH:MM and enter the line at that time of day.
        On startup, trains whose schedule time has already passed *but
        whose travel would not yet be complete* are placed partway along
        the line so the map is populated immediately.
    """

    def __init__(
        self,
        line_config: str = "sections.json",
        timetable_id: str = "realtime_timetable",
    ):
        line_cfg = json.loads(
            (CONFIG_DIR / line_config).read_text(encoding="utf-8")
        )
        self.line_order: list[str] = line_cfg["line_order"]
        self.line_id = line_cfg.get("line_id", "PROTO_LINE")
        self.line_name = line_cfg.get("line_name", "Prototype line")
        self.sections: list[dict] = line_cfg.get("sections", [])

        yards = [
            json.loads((YARDS_DIR / f"{sid}.json").read_text(encoding="utf-8"))
            for sid in self.line_order
        ]

        self.lines: dict[str, dict] = {}
        for yard in yards:
            for l in yard["lines"]:
                if l["id"] not in self.lines:
                    self.lines[l["id"]] = {"direction": l.get("direction", "UP")}

        self.blocks: dict[str, dict] = {}
        self._block_station: dict[str, str] = {}
        for station_id, yard in zip(self.line_order, yards):
            for b in yard["blocks"]:
                self.blocks[b["id"]] = {
                    "lines": {s["line"]: (s["from_x"], s["to_x"]) for s in b["lines"]},
                    "next_blocks": b.get("next_blocks", []),
                }
                self._block_station[b["id"]] = station_id

        self.sequence: dict[str, list[str]] = {}
        for line_id in self.lines:
            self.sequence[line_id] = self._build_sequence(line_id)

        timetable = json.loads(
            (TIMETABLES_DIR / f"{timetable_id}.json").read_text(encoding="utf-8")
        )
        self.mode: str = timetable.get("mode", "loop")

        if self.mode == "realtime":
            self.schedule = sorted(
                timetable["schedule"],
                key=lambda e: _hhmm_to_minutes(e["scheduled_time"]),
            )
            self._schedule_minutes: dict[int, list[dict]] = {}
            for entry in self.schedule:
                sm = _hhmm_to_minutes(entry["scheduled_time"])
                self._schedule_minutes.setdefault(sm, []).append(entry)
            self._scheduled_minute_set = sorted(self._schedule_minutes.keys())
        else:
            self.schedule = sorted(
                timetable["schedule"], key=lambda e: e["entry_min"]
            )

        for entry in self.schedule:
            entry["_spawned"] = False

        self.trains: list[SimTrain] = []
        self._elapsed_min = 0.0
        self._last_tick = time.monotonic()
        self._completed_trains = 0

        # Realtime: back-fill trains already on the line at startup
        if self.mode == "realtime":
            self._realtime_init()

    # ---------- geometry ----------

    def _build_sequence(self, line_id: str) -> list[str]:
        blocks_with_line = [
            bid for bid, blk in self.blocks.items() if line_id in blk["lines"]
        ]
        by_station: dict[str, list[str]] = {sid: [] for sid in self.line_order}
        for bid in blocks_with_line:
            by_station[self._block_station[bid]].append(bid)

        seq: list[str] = []
        for sid in self.line_order:
            ordered = sorted(
                by_station[sid],
                key=lambda b: self.blocks[b]["lines"][line_id][0],
            )
            seq.extend(ordered)
        return seq

    def _traversal(self, line_id: str) -> list[str]:
        seq = self.sequence.get(line_id, [])
        if self.lines.get(line_id, {}).get("direction") == "DN":
            return list(reversed(seq))
        return seq

    def _traversal_len(self, line_id: str) -> int:
        return len(self._traversal(line_id))

    def _next_block(self, train: SimTrain) -> str | None:
        return self._next_block_after(train.line_id, train.block_id)

    def _next_block_after(self, line_id: str, block_id: str) -> str | None:
        seq = self._traversal(line_id)
        try:
            i = seq.index(block_id)
        except ValueError:
            return None
        return seq[i + 1] if i + 1 < len(seq) else None

    # ---------- occupancy ----------

    def _occupied(self, block_id: str, line_id: str) -> bool:
        return any(
            t.block_id == block_id and t.line_id == line_id for t in self.trains
        )

    def occupied_lines(self) -> set[str]:
        return {f"{t.block_id}|{t.line_id}" for t in self.trains}

    # ---------- wall-clock helpers ----------

    @staticmethod
    def _wall_minutes() -> int:
        """Current time as minutes since midnight (local)."""
        now = datetime.now()  # noqa: DTZ005 — local wall-clock, no tz needed
        return now.hour * 60 + now.minute

    def _travel_minutes(self, entry: dict) -> float:
        """Estimated total travel time in sim-minutes for an entry."""
        speed = entry.get("speed_kmph", 90)
        total_blocks = self._traversal_len(entry["line_id"])
        if speed <= 0:
            return float("inf")
        return (total_blocks * BLOCK_LENGTH_KM / speed) * 60

    # ---------- realtime init ----------

    def _realtime_init(self):
        """On startup, spawn trains that should already be on the line.

        For each scheduled entry whose time has passed, if the current
        wall-clock time is still within the train's travel window, place
        it partway along its route proportional to how much time has
        elapsed since its scheduled departure."""
        now_min = self._wall_minutes()
        for entry in self.schedule:
            sched_min = _hhmm_to_minutes(entry["scheduled_time"])
            delay = entry.get("delay_min", 0)
            effective_min = sched_min + delay

            # Skip future trains — they'll spawn via _spawn_due
            if effective_min > now_min:
                continue

            # Skip trains that have already completed their journey
            travel = self._travel_minutes(entry)
            if now_min > effective_min + travel + 5:
                continue

            # Skip if already spawned
            if any(t.train_id == entry["train_id"] for t in self.trains):
                continue

            # Calculate how far along the route the train should be
            elapsed = now_min - effective_min
            total_blocks = self._traversal_len(entry["line_id"])
            blocks_per_min = entry.get("speed_kmph", 90) / (BLOCK_LENGTH_KM * 60)
            blocks_advanced = int(elapsed * blocks_per_min * BLOCK_LENGTH_KM)
            blocks_advanced = min(blocks_advanced, total_blocks - 1)

            seq = self._traversal(entry["line_id"])
            head = seq[blocks_advanced] if blocks_advanced < len(seq) else seq[-1]

            entry["_spawned"] = True
            self.trains.append(
                SimTrain(
                    train_id=entry["train_id"],
                    block_id=head,
                    line_id=entry["line_id"],
                    position=0.0,
                    speed_kmph=entry["speed_kmph"],
                    train_type=entry.get("train_type", "PASSENGER"),
                    stops=[
                        SimStop(s["block_id"], s["dwell_min"])
                        for s in entry.get("stops", [])
                    ],
                )
            )

    # ---------- scheduling ----------

    def _spawn_due(self):
        if self.mode == "realtime":
            self._spawn_due_realtime()
        else:
            self._spawn_due_loop()

    def _spawn_due_realtime(self):
        now_min = self._wall_minutes()
        for entry in self.schedule:
            if entry["_spawned"]:
                continue
            sched_min = _hhmm_to_minutes(entry["scheduled_time"])
            delay = entry.get("delay_min", 0)
            if now_min < sched_min + delay:
                continue
            seq = self._traversal(entry["line_id"])
            if not seq:
                entry["_spawned"] = True
                continue
            if any(t.train_id == entry["train_id"] for t in self.trains):
                entry["_spawned"] = True
                continue
            head = seq[0]
            if self._occupied(head, entry["line_id"]):
                continue
            entry["_spawned"] = True
            self.trains.append(
                SimTrain(
                    train_id=entry["train_id"],
                    block_id=head,
                    line_id=entry["line_id"],
                    position=0.0,
                    speed_kmph=entry["speed_kmph"],
                    train_type=entry.get("train_type", "PASSENGER"),
                    stops=[
                        SimStop(s["block_id"], s["dwell_min"])
                        for s in entry.get("stops", [])
                    ],
                )
            )

    def _spawn_due_loop(self):
        for entry in self.schedule:
            if entry["_spawned"]:
                continue
            due_min = entry["entry_min"] + entry.get("delay_min", 0)
            if self._elapsed_min < due_min:
                continue
            seq = self._traversal(entry["line_id"])
            if not seq:
                entry["_spawned"] = True
                continue
            if any(t.train_id == entry["train_id"] for t in self.trains):
                entry["_spawned"] = True
                continue
            head = seq[0]
            if self._occupied(head, entry["line_id"]):
                continue
            entry["_spawned"] = True
            self.trains.append(
                SimTrain(
                    train_id=entry["train_id"],
                    block_id=head,
                    line_id=entry["line_id"],
                    position=0.0,
                    speed_kmph=entry["speed_kmph"],
                    train_type=entry.get("train_type", "PASSENGER"),
                    stops=[
                        SimStop(s["block_id"], s["dwell_min"])
                        for s in entry.get("stops", [])
                    ],
                )
            )

    def _loop_reset(self):
        if self.mode == "loop" and not self.trains and all(
            e["_spawned"] for e in self.schedule
        ):
            self._elapsed_min = 0.0
            self._completed_trains = 0
            for entry in self.schedule:
                entry["_spawned"] = False

    # ---------- decision steering ----------

    def _decision_map(self) -> dict[str, dict]:
        return {d["train_id"]: d for d in active_decisions()}

    def _seed_from_decisions(self, decisions: dict[str, dict]):
        for decision in decisions.values():
            train_id = decision["train_id"]
            if any(t.train_id == train_id for t in self.trains):
                continue
            block_id = decision["block_id"]
            line_id = decision["line_id"]
            if block_id not in self.blocks:
                continue
            if line_id not in self.lines:
                continue
            seq = self._traversal(line_id)
            if not seq:
                continue
            speed = decision.get("max_speed") or 90
            self.trains.append(
                SimTrain(
                    train_id=train_id,
                    block_id=block_id,
                    line_id=line_id,
                    position=0.0,
                    speed_kmph=speed,
                )
            )

    def train_type(self, train_id: str) -> str:
        for t in self.trains:
            if t.train_id == train_id:
                return t.train_type
        return "PASSENGER"

    # ---------- advancement ----------

    def _advance(self, delta_min: float):
        self._elapsed_min += delta_min
        self._spawn_due()
        decisions = self._decision_map()
        self._seed_from_decisions(decisions)

        for train in list(self.trains):
            decision = decisions.get(train.train_id)

            if decision and not decision["allow_movement"]:
                train.position = min(train.position, 1.0)
                continue

            if train._dwell_remaining > 0:
                train._dwell_remaining -= delta_min
                if train._dwell_remaining <= 0:
                    train._dwell_remaining = 0.0
                continue

            if train.speed_kmph <= 0:
                continue
            effective_speed = train.speed_kmph
            if decision and decision.get("max_speed"):
                effective_speed = min(train.speed_kmph, decision["max_speed"])
            saved_speed = train.speed_kmph
            train.speed_kmph = effective_speed
            advance_train(train, delta_min, BLOCK_LENGTH_KM)
            train.speed_kmph = saved_speed

            if train.position < 1.0:
                continue

            train.position = 1.0

            for stop in train.stops:
                if stop.block_id == train.block_id and stop.block_id not in train._dwelled:
                    train._dwelled.add(stop.block_id)
                    train._dwell_remaining = stop.dwell_min
                    break
            if train._dwell_remaining > 0:
                continue

            next_block = self._next_block(train)
            if next_block and not self._occupied(next_block, train.line_id):
                train.block_id = next_block
                train.position = 0.0
            elif not next_block:
                self.trains.remove(train)
                self._completed_trains += 1

        self._loop_reset()

    def tick(self):
        now = time.monotonic()
        delta_sec = now - self._last_tick
        self._last_tick = now
        if delta_sec > 0:
            self._advance(delta_sec * TIME_SCALE)


section_sim = SectionSim()
