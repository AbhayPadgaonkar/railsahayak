# backend/rules/tracks.py

def check_block_entry(train_id, block_id, occupied_blocks):
    """
    G&SR Absolute Block System:
    - Only one train in a block section at a time
    """

    if block_id in occupied_blocks:
        return {
            "can_enter": False,
            "reason": f"Block {block_id} already occupied"
        }

    return {
        "can_enter": True,
        "reason": "Block clear"
    }


def check_fouling(track_segment, fouling_segments):
    """
    G&SR Fouling Rule:
    - No vehicle should stand fouling a running line
    """

    if track_segment in fouling_segments:
        return {
            "safe": False,
            "reason": "Fouling of adjacent running line detected"
        }

    return {
        "safe": True,
        "reason": "No fouling"
    }
