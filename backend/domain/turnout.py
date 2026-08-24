from dataclasses import dataclass


@dataclass
class Turnout:
    turnout_id: str
    block_id: str
    connected_lines: list[str]
