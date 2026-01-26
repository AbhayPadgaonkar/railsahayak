from backend.engine.train_movement import advance_train
from backend.engine.block_release import release_line_if_cleared


def section_tick(train_states, blocks, occupied_lines, delta_minutes=1):
    """
    Advances entire section by delta_minutes.
    """
    released = []

    for train in train_states:
        block = blocks[train.block_id]

        advance_train(train, delta_minutes, block.length_km)

        if release_line_if_cleared(train, occupied_lines):
            released.append(train.train_id)

    return released
