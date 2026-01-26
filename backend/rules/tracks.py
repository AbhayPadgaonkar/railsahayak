# backend/rules/tracks.py

def check_line_entry(train_id, block_id, line_id, occupied_lines):
    """
    Indian Railways Absolute Block + Line Occupancy:
    - One train per line per block
    """

    key = f"{block_id}|{line_id}"

    if key in occupied_lines:
        return {
            "can_enter": False,
            "reason": f"Line {line_id} in block {block_id} already occupied"
        }

    return {
        "can_enter": True,
        "reason": "Line clear"
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
