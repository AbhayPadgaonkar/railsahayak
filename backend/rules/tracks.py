# backend/rules/tracks.py

def check_line_entry(train_id, line_id, occupied_lines):
    """
    G&SR Absolute Block System:
    - Only one train in a block section at a time
    """
    
    if line_id in occupied_lines:
        return {
            "can_enter": False,
            "reason": f"Line {line_id} already occupied"
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
