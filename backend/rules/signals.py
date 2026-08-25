# backend/rules/signals.py

def check_signal_permission(train, signal_state, has_written_authority=False):
    """
    G&SR Principle:
    - No train shall pass a signal at ON (RED)
    - Exception only with written authority at caution speed

    Aspect naming follows IR 4-aspect signalling:
    GREEN / SINGLE_YELLOW / DOUBLE_YELLOW / RED / DEFECTIVE.
    """

    state = str(signal_state).strip().upper()

    if state in ["RED", "DEFECTIVE"]:
        if not has_written_authority:
            return {
                "can_proceed": False,
                "reason": "Signal at ON / Defective without authority"
            }
        return {
            "can_proceed": True,
            "speed_mode": "CAUTION",
            "reason": "Proceed with written authority at caution speed"
        }

    if state in ["YELLOW", "SINGLE_YELLOW"]:
        return {
            "can_proceed": True,
            "speed_mode": "CAUTION",
            "reason": "Signal at caution – proceed with restricted speed"
        }

    if state == "DOUBLE_YELLOW":
        return {
            "can_proceed": True,
            "speed_mode": "CAUTION",
            "reason": "Signal at double yellow – proceed and be prepared to pass next signal at single yellow"
        }

    return {
        "can_proceed": True,
        "speed_mode": "NORMAL",
        "reason": "Signal clear"
    }
