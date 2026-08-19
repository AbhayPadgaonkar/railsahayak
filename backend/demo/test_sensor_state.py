from backend.simulation.sensor_state import SensorState


def test_empty_snapshot():
    ss = SensorState()
    assert ss.snapshot() == {"blocks": {}, "tracks": {}}


def test_block_occupancy_in_snapshot():
    ss = SensorState()
    ss.add_block("upMain_1")
    ss.blocks["upMain_1"].axle_enter(16)
    snap = ss.snapshot()
    assert snap["blocks"]["upMain_1"] is True


def test_track_occupancy_in_snapshot():
    ss = SensorState()
    ss.add_track("platform_1")
    ss.tracks["platform_1"].shunt()
    snap = ss.snapshot()
    assert snap["tracks"]["platform_1"] is True


def test_released_sensors_show_clear():
    ss = SensorState()
    ss.add_block("upMain_1")
    ss.add_track("platform_1")
    ss.blocks["upMain_1"].axle_enter(16)
    ss.tracks["platform_1"].shunt()
    ss.blocks["upMain_1"].axle_exit(16)
    ss.tracks["platform_1"].clear()
    snap = ss.snapshot()
    assert snap["blocks"]["upMain_1"] is False
    assert snap["tracks"]["platform_1"] is False