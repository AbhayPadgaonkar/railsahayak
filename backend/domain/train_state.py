from dataclasses import dataclass


@dataclass
class TrainState:
    train_id: str
    current_block: str
    current_line: str
    position: float        # 0.0 = start of block, 1.0 = end
    speed_kmph: int
