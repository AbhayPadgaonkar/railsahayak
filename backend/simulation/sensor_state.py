from .axle_counter import AxleCounterBlock
from .track_circuit import TrackCircuit


class SensorState:
    def __init__(self):
        self.blocks = {}
        self.tracks = {}

    def add_block(self, block_id: str):
        self.blocks[block_id] = AxleCounterBlock(block_id)

    def add_track(self, track_id: str):
        self.tracks[track_id] = TrackCircuit(track_id)

    def snapshot(self):
        return {
            "blocks": {
                bid: blk.occupied for bid, blk in self.blocks.items()
            },
            "tracks": {
                tid: tc.occupied for tid, tc in self.tracks.items()
            }
        }
