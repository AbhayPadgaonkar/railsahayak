from dataclasses import dataclass
from typing import List


@dataclass
class Block:
    block_id: str
    length_km: float
    running_lines: List[str]
