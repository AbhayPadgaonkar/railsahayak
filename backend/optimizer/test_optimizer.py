from section_optimizer import optimize_train_order

trains = [
    {
        "train_id": "EXP1",
        "priority": 2,
        "predicted_delay": 5,
        "block_id": "B7",
        "train_type": "RAJDHANI",
        "gradient": None
    },
    {
        "train_id": "G3",
        "priority": 7,
        "predicted_delay": 10,
        "block_id": "B7",
        "train_type": "GOODS",
        "gradient": {
            "value": 200,
            "direction": "UP"
        }
    }
]

result = optimize_train_order(trains)
print([t["train_id"] for t in result])
