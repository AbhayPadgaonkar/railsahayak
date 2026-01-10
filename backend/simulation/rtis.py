class RTISFeed:
    def __init__(self, train_id: str):
        self.train_id = train_id
        self.lat = None
        self.lon = None
        self.speed = 0.0

    def update(self, lat: float, lon: float, speed: float):
        self.lat = lat
        self.lon = lon
        self.speed = speed

    def snapshot(self):
        return {
            "train_id": self.train_id,
            "lat": self.lat,
            "lon": self.lon,
            "speed": self.speed,
        }
