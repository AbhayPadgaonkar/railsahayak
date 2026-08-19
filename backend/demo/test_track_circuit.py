from backend.simulation.track_circuit import TrackCircuit


def test_initial_state_is_not_occupied():
    tc = TrackCircuit("platform_1")
    assert tc.occupied is False


def test_shunt_occupies_circuit():
    tc = TrackCircuit("platform_1")
    tc.shunt()
    assert tc.occupied is True


def test_clear_releases_circuit():
    tc = TrackCircuit("platform_1")
    tc.shunt()
    tc.clear()
    assert tc.occupied is False


def test_clear_when_idle_is_safe():
    tc = TrackCircuit("platform_1")
    tc.clear()
    assert tc.occupied is False