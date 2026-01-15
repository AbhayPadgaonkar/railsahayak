import numpy as np
from typing import Dict


class DelayPredictor:
    """
    Advisory ML model.
    Predicts delay in minutes.
    """

    def __init__(self):
        # Dummy coefficients (replace later with trained values)
        self.weights = {
            "sectional_speed": -0.05,
            "priority": -1.0,
            "is_goods": 3.0,
            "gradient_severity": 2.5,
            "fog": 4.0,
        }
        self.bias = 2.0

    def predict(self, features: Dict) -> float:
        delay = self.bias
        for key, value in features.items():
            delay += self.weights.get(key, 0) * value
        return max(delay, 0.0)
