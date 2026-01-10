class TrackCircuit:
    def __init__(self, track_id: str):
        self.track_id = track_id
        self.occupied = False

    def shunt(self):
        self.occupied = True

    def clear(self):
        self.occupied = False
