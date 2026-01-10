# backend/rules/signals.py

def check_signal_permission(train, signal_state, has_written_authority=False):
    """
    G&SR Principle:
    - No train shall pass a signal at ON (RED)
    - Exception only with written authority at caution speed
    """

    if signal_state in ["RED", "DEFECTIVE"]:
        if not has_written_authority:
            return {
                "can_proceed": False,
                "reason": "Signal at ON / Defective without authority"
            }
        else:
            return {
                "can_proceed": True,
                "speed_mode": "CAUTION",
                "reason": "Proceed with written authority at caution speed"
            }

    return {
        "can_proceed": True,
        "speed_mode": "NORMAL",
        "reason": "Signal clear"
    }
