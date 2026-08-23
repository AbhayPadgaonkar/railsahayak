import time

from backend.services.rtis_replay import RTISReplay


def test_replay_applies_events_in_order():
    replay = RTISReplay()
    replay.start()

    snapshots = replay.snapshots()
    assert len(snapshots) == 1
    assert snapshots[0]["train_id"] == "T101"

    time.sleep(2.1)
    snapshots = replay.snapshots()
    train_ids = {s["train_id"] for s in snapshots}
    assert train_ids == {"T101", "T201"}


def test_replay_finished_after_last_event():
    replay = RTISReplay()
    replay.start()
    time.sleep(0.1)
    replay.tick()
    assert not replay.finished
