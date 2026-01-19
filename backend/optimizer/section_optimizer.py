from ortools.sat.python import cp_model


def optimize_train_order(trains):
    """
    Indian Railways compliant optimizer

    trains = list of dicts:
    {
        train_id,
        priority,             # 1 = highest
        predicted_delay,
        block_id,
        line_id,
        train_type,           # GOODS / RAJDHANI / etc
        gradient              # { value, direction } or None
    }
    """

    model = cp_model.CpModel()
    n = len(trains)

    order = {
        t["train_id"]: model.NewIntVar(0, n - 1, f'order_{t["train_id"]}')
        for t in trains
    }

    model.AddAllDifferent(order.values())

    # --- HARD CONSTRAINT 1: Same block + same line contention ---
    for i in range(n):
        for j in range(i + 1, n):
            t1 = trains[i]
            t2 = trains[j]

            if (
                t1["block_id"] == t2["block_id"]
                and t1["line_id"] == t2["line_id"]
            ):
                model.Add(order[t1["train_id"]] != order[t2["train_id"]])

    # --- HARD CONSTRAINT 2: Priority dominance (IR rule) ---
    # Applies unless overridden by gradient exception (IR practice)
    def has_steep_up_gradient(train):
        g = train.get("gradient")
        return g and g["direction"] == "UP" and g["value"] <= 200
    
    for i in range(n):
        for j in range(n):
            if i == j:
                continue

            t1 = trains[i]
            t2 = trains[j]

            if (
                t1["block_id"] == t2["block_id"]
                and t1["line_id"] == t2["line_id"]
                and t1["priority"] < t2["priority"]
                and not has_steep_up_gradient(t2)
            ):
                model.Add(order[t1["train_id"]] < order[t2["train_id"]])

    # --- EXCEPTION: Goods-first on steep UP gradient (Appendix D / Ghat practice) ---
    for t in trains:
        if t["train_type"] == "GOODS":
            g = t.get("gradient")
            if g and g["direction"] == "UP" and g["value"] <= 200:
                model.Add(order[t["train_id"]] == 0)

    # --- OBJECTIVE: Minimize total delay AFTER precedence ---
    model.Minimize(
        sum(
            t["current_delay"] * order[t["train_id"]]
            for t in trains
        )
    )

    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    return sorted(
        trains,
        key=lambda t: solver.Value(order[t["train_id"]])
    )
