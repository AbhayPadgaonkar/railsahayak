from dataclasses import dataclass
from typing import List


@dataclass
class Block:
    block_id: str
    from_station: str
    to_station: str
    lines: List[str]


@dataclass
class Section:
    section_id: str
    blocks: List[Block]
