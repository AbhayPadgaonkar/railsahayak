import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Set

BLOCK_LENGTH_KM = 4.0
TIME_SCALE = 0.5  # real seconds -> sim minutes (2 real sec = 1 sim min)

YARDS_DIR = Path(__file__).resolve().parent.parent / "config" / "yards"


@dataclass
class SimTrain:
    train_id: str
    block_id: str
    line_id: str
    position: float  # 0.0 = start of block, 1.0 = clear
    speed_kmph: int


class SectionSim:
    """In-memory live section: trains move block-to-block along each line's
    next_blocks chain; a block|line is occupied until a train fully clears it
    (absolute block semantics). Advanced lazily by wall-clock time on read."""

    def __init__(self):
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

        self.trains: List[SimTrain] = [
            SimTrain("S-RAJ1", "A_B", "UP_MAIN", 0.0, 110),
            SimTrain("S-VB2", "C_D", "DN_MAIN", 0.3, 130),
        ]
        self._last_tick = time.monotonic()

    def _build_sequence(self, line_id: str) -> List[str]:
        block_ids = [
            bid for bid, blk in self.blocks.items() if line_id in blk["lines"]
        ]
        if not block_ids:
            return []
        starts = [
            bid
            for bid in block_ids
            if not any(
                bid in self.blocks[p]["next_blocks"] for p in block_ids
            )
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

    def _advance(self, delta_minutes: float):
        for train in self.trains:
            if train.speed_kmph <= 0:
                continue
            distance_km = (train.speed_kmph * delta_minutes) / 60
            train.position += distance_km / BLOCK_LENGTH_KM

            if train.position < 1.0:
                continue

            train.position = 1.0  # train fully clears current block

            next_block = self._next_block(train)
            if next_block and not self._occupied(next_block, train.line_id):
                train.block_id = next_block
                train.position = 0.0
            elif not next_block:
                # Terminal block with nowhere to go — respawn at line head (demo loop)
                seq = self._traversal(train.line_id)
                if seq:
                    train.block_id = seq[0]
                    train.position = 0.0

    def _occupied(self, block_id: str, line_id: str) -> bool:
        return any(
            t.block_id == block_id and t.line_id == line_id for t in self.trains
        )

    def occupied_lines(self) -> Set[str]:
        return {f"{t.block_id}|{t.line_id}" for t in self.trains}

    def tick(self):
        now = time.monotonic()
        delta_sec = now - self._last_tick
        self._last_tick = now
        if delta_sec > 0:
            self._advance(delta_sec * TIME_SCALE)


section_sim = SectionSim()