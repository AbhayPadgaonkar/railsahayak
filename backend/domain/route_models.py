from dataclasses import dataclass
from typing import List


@dataclass
class Route:
    block_id: str
    line_id: str
    turnouts: List[str]
