def advance_train(train_state, delta_time_minutes, block_length_km):
    """
    Moves train forward inside a block
    """

    distance_covered = (
        train_state.speed_kmph * delta_time_minutes
    ) / 60

    progress_delta = distance_covered / block_length_km

    train_state.position = min(
        1.0,
        train_state.position + progress_delta
    )

    return train_state
