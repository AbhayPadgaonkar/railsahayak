from dataclasses import dataclass
from typing import List


@dataclass
class Block:
    block_id: str
    next_blocks: List[str]


@dataclass
class Section:
    section_id: str
    blocks: List[Block]

    def get_next_block(self, block_id: str) -> str | None:
        for b in self.blocks:
            if b.block_id == block_id and b.next_blocks:
                return b.next_blocks[0]
        return None
