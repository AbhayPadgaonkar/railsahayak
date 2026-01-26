from dataclasses import dataclass
from typing import List


@dataclass
class Turnout:
    turnout_id: str
    block_id: str
    connected_lines: List[str]
