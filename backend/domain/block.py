from dataclasses import dataclass


@dataclass
class Block:
    block_id: str
    length_km: float
    running_lines: list[str]
