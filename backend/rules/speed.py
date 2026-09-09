def determine_speed_limit(
    sectional_speed: int,
    condition=None,
    gradient=None,
    signal_mode="NORMAL",
):
    max_speed = sectional_speed
    reasons = []

    # G&SR Chapter V – Caution signal (speed restricted regardless of aspect)
    if signal_mode == "CAUTION":
        max_speed = min(max_speed, 30)
        reasons.append("Restrictive signal – speed restricted to 30 km/h")

    # G&SR Chapter IV – Speed restrictions by condition
    if condition == "FOG":
        max_speed = min(max_speed, 60)
        reasons.append("Speed restricted due to fog as per caution orders")

    if condition == "RAIN":
        max_speed = min(max_speed, 70)
        reasons.append("Speed restricted due to rain as per safety instructions")

    if condition == "STORM":
        max_speed = min(max_speed, 40)
        reasons.append("Speed restricted due to storm as per safety instructions")

    if condition == "THUNDERSTORM":
        max_speed = min(max_speed, 30)
        reasons.append("Speed restricted due to thunderstorm as per emergency advisory")

    # G&SR Appendix D – Gradient / Ghat rules
    # Gradients below 25‰ are considered mild and don't trigger speed restrictions.
    if gradient is not None:
        g = gradient.value
        direction = gradient.direction

        if g < 25:
            pass  # mild gradient, no restriction

        elif direction == "DOWN":
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
