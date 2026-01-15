from ortools.sat.python import cp_model


def optimize_train_order(trains):
    """
    trains = list of dicts:
    {
        train_id,
        priority,
        predicted_delay,
        block_id,
        train_type,          # "GOODS", "RAJDHANI", etc
        gradient             # { "value": int, "direction": "UP" | "DOWN" } or None
    }
    """

    model = cp_model.CpModel()
    n = len(trains)

    # Order variable for each train
    order = {
        train["train_id"]: model.NewIntVar(
            0, n - 1, f'order_{train["train_id"]}'
        )
        for train in trains
    }

    # Each train gets a unique order
    model.AddAllDifferent(order.values())

    # BLOCK CONTENTION CONSTRAINT
    for i in range(n):
        for j in range(i + 1, n):
            t1 = trains[i]
            t2 = trains[j]

            if t1["block_id"] == t2["block_id"]:
                model.Add(
                    order[t1["train_id"]] != order[t2["train_id"]]
                )

    # GRADIENT PROTECTION (GOODS ON STEEP UP GRADIENT)
    for train in trains:
        if train["train_type"] == "GOODS":
            gradient = train.get("gradient")
            if (
                gradient
                and gradient["direction"] == "UP"
                and gradient["value"] <= 200
            ):
                # Goods train should be scheduled early
                model.Add(order[train["train_id"]] <= 1)

    # OBJECTIVE: MINIMIZE WEIGHTED DELAY
    objective_terms = []

    for train in trains:
        base_weight = 10 - train["priority"]
        delay = train["predicted_delay"]

        goods_penalty = 5 if train["train_type"] == "GOODS" else 0

        objective_terms.append(
            (base_weight + goods_penalty)
            * delay
            * order[train["train_id"]]
        )

    model.Minimize(sum(objective_terms))

    # SOLVE
    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    # Return trains ordered by optimized sequence
    return sorted(
        trains,
        key=lambda t: solver.Value(order[t["train_id"]])
    )
