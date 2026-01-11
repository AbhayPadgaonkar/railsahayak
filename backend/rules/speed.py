def determine_speed_limit(
    sectional_speed: int,
    condition=None,
    gradient=None
):
    max_speed = sectional_speed
    reasons = []

    # G&SR Chapter IV – Speed restrictions by condition
    if condition == "FOG":
        max_speed = min(max_speed, 60)
        reasons.append("Speed restricted due to fog as per caution orders")

    if condition == "STORM":
        max_speed = min(max_speed, 40)
        reasons.append("Speed restricted due to storm as per safety instructions")

    # G&SR Appendix D – Gradient / Ghat rules
    if gradient is not None:
        g = gradient.value
        direction = gradient.direction

        if direction == "DOWN":
            if g <= 100:
                max_speed = min(max_speed, 25)
                reasons.append("Falling gradient (Ghat section) – severe speed restriction")
            elif g <= 200:
                max_speed = min(max_speed, 30)
                reasons.append("Falling gradient – restricted speed")
            elif g <= 500:
                max_speed = min(max_speed, 50)
                reasons.append("Falling gradient – moderate restriction")

        elif direction == "UP":
            if g <= 100:
                max_speed = min(max_speed, 30)
                reasons.append("Rising gradient (Ghat section) – restricted speed")
            elif g <= 200:
                max_speed = min(max_speed, 40)
                reasons.append("Rising gradient – speed restriction applied")
            elif g <= 500:
                max_speed = min(max_speed, 60)
                reasons.append("Rising gradient – moderate restriction")

    return {
        "max_speed": max_speed,
        "reason": "; ".join(reasons) if reasons else "Within sectional speed limits"
    }
