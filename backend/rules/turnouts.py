def check_turnout_conflict(
    train_id,
    block_id,
    line_id,
    occupied_turnouts,
    route_service,
):
    required = route_service.get_turnouts(block_id, line_id)

    for turnout in required:
        if turnout in occupied_turnouts:
            return {
                "can_proceed": False,
                "reason": f"Turnout {turnout} already locked"
            }

    return {
        "can_proceed": True,
        "required_turnouts": required
    }
