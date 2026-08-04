from backend.optimizer.section_optimizer import optimize_train_order


def test_goods_first_on_steep_up_gradient():
    trains = [
        {
            "train_id": "EXP1",
            "priority": 2,
            "current_delay": 5,
            "block_id": "B7",
            "line_id": "L1",
            "train_type": "RAJDHANI",
            "gradient": None,
        },
        {
            "train_id": "G3",
            "priority": 7,
            "current_delay": 10,
            "block_id": "B7",
            "line_id": "L1",
            "train_type": "GOODS",
            "gradient": {"value": 200, "direction": "UP"},
        },
    ]

    result = optimize_train_order(trains)
    assert result is not None
    assert [t["train_id"] for t in result] == ["G3", "EXP1"]


def test_priority_dominance_without_gradient():
    trains = [
        {
            "train_id": "G3",
            "priority": 7,
            "current_delay": 10,
            "block_id": "B7",
            "line_id": "L1",
            "train_type": "GOODS",
            "gradient": None,
        },
        {
            "train_id": "EXP1",
            "priority": 2,
            "current_delay": 5,
            "block_id": "B7",
            "line_id": "L1",
            "train_type": "RAJDHANI",
            "gradient": None,
        },
    ]

    result = optimize_train_order(trains)
    assert result is not None
    assert [t["train_id"] for t in result] == ["EXP1", "G3"]


if __name__ == "__main__":
    test_goods_first_on_steep_up_gradient()
    test_priority_dominance_without_gradient()
    print("All optimizer tests passed")
