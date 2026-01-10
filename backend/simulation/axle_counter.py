class AxleCounterBlock:
    def __init__(self, block_id: str):
        self.block_id = block_id
        self.n_in = 0
        self.n_out = 0
        self.occupied = False

    def axle_enter(self, axles: int):
        self.n_in += axles
        self.occupied = True

    def axle_exit(self, axles: int):
        self.n_out += axles
        if self.n_in == self.n_out:
            self.occupied = False

    def reset(self):
        self.n_in = 0
        self.n_out = 0
        self.occupied = False
