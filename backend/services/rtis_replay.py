import json
import time
from pathlib import Path

from backend.simulation.rtis import RTISFeed

DEFAULT_FEED_PATH = Path(__file__).resolve().parent.parent / "config" / "rtis" / "demo_feed.json"


class RTISReplay:
    """Replay a recorded RTIS feed relative to a start time.

    Events are applied in `offset_seconds` order; calling `tick()` advances the
    replayed feeds to the current elapsed time. Snapshots expose the latest
    known position/speed for every train seen so far.
    """

    def __init__(self, feed_path: Path | None = None):
        self.feed_path = feed_path or DEFAULT_FEED_PATH
        self._events: list[dict] = []
        self._feeds: dict[str, RTISFeed] = {}
        self._start_time: float | None = None
        self._index = 0
        self._load()

    def _load(self):
        data = json.loads(self.feed_path.read_text(encoding="utf-8"))
        self._events = sorted(
            data.get("events", []),
            key=lambda event: event["offset_seconds"],
        )

    def start(self):
        """Reset replay to the beginning."""
        self._start_time = time.monotonic()
        self._index = 0
        self._feeds = {}

    def elapsed_seconds(self) -> float:
        if self._start_time is None:
            self.start()
        return time.monotonic() - self._start_time  # type: ignore[operator]

    def tick(self):
        """Apply all events whose offset has been reached."""
        elapsed = self.elapsed_seconds()
        while self._index < len(self._events):
            event = self._events[self._index]
            if event["offset_seconds"] > elapsed:
                break
            feed = self._feeds.setdefault(event["train_id"], RTISFeed(event["train_id"]))
            feed.update(
                lat=event.get("lat"),
                lon=event.get("lon"),
                speed=event.get("speed", 0.0),
            )
            self._index += 1

    def snapshots(self) -> list[dict]:
        """Return current snapshots for all tracked trains."""
        self.tick()
        return [feed.snapshot() for feed in self._feeds.values()]

    @property
    def finished(self) -> bool:
        return self._index >= len(self._events)


# Global replay instance used by the API.
rtis_replay = RTISReplay()
