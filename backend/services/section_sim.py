import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set

BLOCK_LENGTH_KM = 4.0
TIME_SCALE = 0.5  # real seconds -> sim minutes (2 real sec = 1 sim min)

YARDS_DIR = Path(__file__).resolve().parent.parent / "config" / "yards"
TIMETABLES_DIR = Path(__file__).resolve().parent.parent / "config" / "timetables"


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
    block|line is occupied until a train fully clears it."""

    def __init__(self, timetable_id: str = "demo_timetable"):
        yard = json.loads(
            (YARDS_DIR / "demo_yard.json").read_text(encoding="utf-8")
        )
        self.lines = {l["id"]: l for l in yard["lines"]}
        self.blocks: Dict[str, dict] = {}
        for b in yard["blocks"]:
            self.blocks[b["id"]] = {
                "lines": {s["line"]: (s["from_x"], s["to_x"]) for s in b["lines"]},
                "next_blocks": b.get("next_blocks", []),
            }

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
        block_ids = [
            bid for bid, blk in self.blocks.items() if line_id in blk["lines"]
        ]
        if not block_ids:
            return []
        starts = [
            bid
            for bid in block_ids
            if not any(bid in self.blocks[p]["next_blocks"] for p in block_ids)
        ]
        if not starts:
            starts = [block_ids[0]]
        seq: List[str] = []
        seen: Set[str] = set()
        for start in starts:
            cur = start
            while cur and cur not in seen and cur in block_ids:
                seen.add(cur)
                seq.append(cur)
                cur = next(
                    (n for n in self.blocks[cur]["next_blocks"] if n in block_ids),
                    None,
                )
        return seq

    def _traversal(self, line_id: str) -> List[str]:
        seq = self.sequence.get(line_id, [])
        if self.lines.get(line_id, {}).get("direction") == "DN":
            return list(reversed(seq))
        return seq

    def _next_block(self, train: SimTrain) -> Optional[str]:
        seq = self._traversal(train.line_id)
        try:
            i = seq.index(train.block_id)
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

    # ---------- advancement ----------

    def _advance(self, delta_min: float):
        self._elapsed_min += delta_min
        self._spawn_due()

        for train in list(self.trains):
            if train._dwell_remaining > 0:
                train._dwell_remaining -= delta_min
                if train._dwell_remaining <= 0:
                    train._dwell_remaining = 0.0
                continue

            if train.speed_kmph <= 0:
                continue
            distance_km = (train.speed_kmph * delta_min) / 60
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
                # Terminal block cleared — train leaves the section
                self.trains.remove(train)

        self._loop_reset()

    def tick(self):
        now = time.monotonic()
        delta_sec = now - self._last_tick
        self._last_tick = now
        if delta_sec > 0:
            self._advance(delta_sec * TIME_SCALE)


section_sim = SectionSim()
