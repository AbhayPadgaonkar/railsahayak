from dataclasses import dataclass


@dataclass
class Route:
    block_id: str
    line_id: str
    turnouts: list[str]
