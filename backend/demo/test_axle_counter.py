from backend.simulation.axle_counter import AxleCounterBlock


def test_initial_state_is_not_occupied():
    block = AxleCounterBlock("upMain_1")
    assert block.occupied is False
    assert block.n_in == 0
    assert block.n_out == 0


def test_axle_enter_occupies_block():
    block = AxleCounterBlock("upMain_1")
    block.axle_enter(axles=16)
    assert block.occupied is True
    assert block.n_in == 16


def test_axle_exit_clears_when_counts_match():
    block = AxleCounterBlock("upMain_1")
    block.axle_enter(axles=16)
    block.axle_exit(axles=16)
    assert block.occupied is False
    assert block.n_out == 16


def test_partial_axle_exit_keeps_block_occupied():
    block = AxleCounterBlock("upMain_1")
    block.axle_enter(axles=16)
    block.axle_exit(axles=8)
    assert block.occupied is True
    assert block.n_out == 8


def test_reset_clears_counters():
    block = AxleCounterBlock("upMain_1")
    block.axle_enter(axles=16)
    block.reset()
    assert block.occupied is False
    assert block.n_in == 0
    assert block.n_out == 0