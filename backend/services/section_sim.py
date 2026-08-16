import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set

from backend.services.decision_state import active_decisions

BLOCK_LENGTH_KM = 4.0
TIME_SCALE = 0.5  # real seconds -> sim minutes (2 real sec = 1 sim min)

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
    stops: List[SimStop] = field(default_factory=list)
    _dwelled: Set[str] = field(default_factory=set)
    _dwell_remaining: float = 0.0


class SectionSim:
    """In-memory live section driven by a JSON timetable.

    Trains spawn at the head of their line's traversal when the sim clock
    reaches their (possibly delayed) entry time, move block-to-block by
    sectional speed, dwell at scheduled stops (occupying the block), and
    exit once they clear the section. The schedule loops so the map stays
    live indefinitely. Occupancy follows absolute-block semantics: a
    block|line is occupied until a train fully clears it.

    Model: the full line consists of the stations listed in sections.json
    `line_order`. Each station contributes its yard's lines and blocks
    (globally-unique block ids), and the per-line traversal walks the
    stations in order, so a single train crosses the entire line.
    """

    def __init__(
        self,
        line_config: str = "sections.json",
        timetable_id: str = "proto_timetable",
    ):
        line_cfg = json.loads(
            (CONFIG_DIR / line_config).read_text(encoding="utf-8")
        )
        self.line_order: List[str] = line_cfg["line_order"]
        self.line_id = line_cfg.get("line_id", "PROTO_LINE")
        self.line_name = line_cfg.get("line_name", "Prototype line")
        self.sections: List[dict] = line_cfg.get("sections", [])

        yards = [
            json.loads((YARDS_DIR / f"{sid}.json").read_text(encoding="utf-8"))
            for sid in self.line_order
        ]

        self.lines: Dict[str, dict] = {}
        for yard in yards:
            for l in yard["lines"]:
                if l["id"] not in self.lines:
                    self.lines[l["id"]] = {"direction": l.get("direction", "UP")}

        self.blocks: Dict[str, dict] = {}
        self._block_station: Dict[str, str] = {}
        for station_id, yard in zip(self.line_order, yards):
            for b in yard["blocks"]:
                self.blocks[b["id"]] = {
                    "lines": {s["line"]: (s["from_x"], s["to_x"]) for s in b["lines"]},
                    "next_blocks": b.get("next_blocks", []),
                }
                self._block_station[b["id"]] = station_id

        self.sequence: Dict[str, List[str]] = {}
        for line_id in self.lines:
            self.sequence[line_id] = self._build_sequence(line_id)

        timetable = json.loads(
            (TIMETABLES_DIR / f"{timetable_id}.json").read_text(encoding="utf-8")
        )
        self.schedule = sorted(timetable["schedule"], key=lambda e: e["entry_min"])
        for entry in self.schedule:
            entry["_spawned"] = False

        self.trains: List[SimTrain] = []
        self._elapsed_min = 0.0
        self._last_tick = time.monotonic()

    # ---------- geometry ----------

    def _build_sequence(self, line_id: str) -> List[str]:
        """Full-line traversal in station order.

        Each line runs through every station: collect that station's blocks
        that carry the line, order them by x (ascending), and append in
        line_order. Blocks have globally-unique ids so cross-station next is
        ``station i's last block -> station i+1's first block``."""
        blocks_with_line = [
            bid for bid, blk in self.blocks.items() if line_id in blk["lines"]
        ]
        by_station: Dict[str, List[str]] = {sid: [] for sid in self.line_order}
        for bid in blocks_with_line:
            by_station[self._block_station[bid]].append(bid)

        seq: List[str] = []
        for sid in self.line_order:
            ordered = sorted(
                by_station[sid],
                key=lambda b: self.blocks[b]["lines"][line_id][0],
            )
            seq.extend(ordered)
        return seq

    def _traversal(self, line_id: str) -> List[str]:
        seq = self.sequence.get(line_id, [])
        if self.lines.get(line_id, {}).get("direction") == "DN":
            return list(reversed(seq))
        return seq

    def _next_block(self, train: SimTrain) -> Optional[str]:
        return self._next_block_after(train.line_id, train.block_id)

    def _next_block_after(self, line_id: str, block_id: str) -> Optional[str]:
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

    def occupied_lines(self) -> Set[str]:
        return {f"{t.block_id}|{t.line_id}" for t in self.trains}

    # ---------- scheduling ----------

    def _spawn_due(self):
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
                # already on the map (e.g. seeded from a decision) — don't duplicate
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
        if not self.trains and all(e["_spawned"] for e in self.schedule):
            self._elapsed_min = 0.0
            for entry in self.schedule:
                entry["_spawned"] = False

    # ---------- decision steering ----------

    def _decision_map(self) -> Dict[str, dict]:
        return {d["train_id"]: d for d in active_decisions()}

    def _seed_from_decisions(self, decisions: Dict[str, dict]):
        """Spawn a sim train for a decided train that is not yet on the map,
        so a controller-created train from POST /decision appears in motion."""
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
        """Train class for a live sim train (used by the advisory layer)."""
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
                # HOLD: train stops where it is until a release decision
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
            distance_km = (effective_speed * delta_min) / 60
            train.position += distance_km / BLOCK_LENGTH_KM

            if train.position < 1.0:
                continue

            train.position = 1.0  # fully cleared current block

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
                # Terminal block cleared — train leaves the line
                self.trains.remove(train)

        self._loop_reset()

    def tick(self):
        now = time.monotonic()
        delta_sec = now - self._last_tick
        self._last_tick = now
        if delta_sec > 0:
            self._advance(delta_sec * TIME_SCALE)


section_sim = SectionSim()