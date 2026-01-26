def release_line_if_cleared(train_state, occupied_lines):
    """
    Releases line only when train fully clears block.
    """
    if train_state.position >= 1.0:
        key = f"{train_state.block_id}:{train_state.line_id}"
        if key in occupied_lines:
            occupied_lines.remove(key)
        return True
    return False
