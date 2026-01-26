def advance_train(train_state, delta_minutes, block_length_km):
    """
    Advances train position inside a block.
    """
    if train_state.speed_kmph <= 0:
        return train_state

    distance_km = (train_state.speed_kmph * delta_minutes) / 60
    delta_position = distance_km / block_length_km

    train_state.position = min(1.0, train_state.position + delta_position)
    return train_state
