# backend/rules/emergency.py

def emergency_mode_decision(disaster_active):
    """
    G&SR Emergency Rule:
    - During disaster, safety overrides punctuality
    - Controller may suspend normal operations
    """

    if disaster_active:
        return {
            "optimization_allowed": False,
            "allowed_actions": ["HOLD"],
            "reason": "Disaster mode – safety-first operation"
        }

    return {
        "optimization_allowed": True,
        "allowed_actions": ["PROCEED", "HOLD", "DIVERT", "MAINTAIN_SPEED"],
        "reason": "Normal operation"
    }
