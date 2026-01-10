# backend/rules/speed.py

def determine_speed_limit(
    sectional_speed,
    condition=None,
    gradient=None
):
    """
    G&SR Speed Rules:
    - Sectional speed shall never be exceeded
    - Caution speed under abnormal conditions
    """

    if condition in ["FOG", "STORM", "SIGNAL_FAILURE", "OBSTRUCTION"]:
        return {
            "max_speed": min(30, sectional_speed),
            "reason": "Abnormal condition – caution speed enforced"
        }

    if gradient and gradient > 1.0:
        return {
            "max_speed": min(sectional_speed, 40),
            "reason": "Steep gradient – restricted speed"
        }

    return {
        "max_speed": sectional_speed,
        "reason": "Normal operation"
    }
