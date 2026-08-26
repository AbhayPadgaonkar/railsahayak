
import json
from pathlib import Path


class DelayPredictor:
    """Advisory ML model.

    Predicts delay in minutes.  Loads trained coefficients from
    ``delay_model.json`` (produced by ``train_delay_model.py``); falls back to
    a small set of hand-tuned coefficients if the model file is missing.
    """

    _MODEL_PATH = Path(__file__).with_name("delay_model.json")

    def __init__(self):
        if self._MODEL_PATH.is_file():
            model = json.loads(self._MODEL_PATH.read_text(encoding="utf-8"))
            self.weights = model.get("weights", {})
            self.bias = model.get("bias", 0.0)
        else:
            # Fallback coefficients used when the trained model is not present.
            self.weights = {
                "sectional_speed": -0.05,
                "priority": -1.0,
                "is_goods": 3.0,
                "gradient_severity": 2.5,
                "fog": 4.0,
            }
            self.bias = 2.0

    def predict(self, features: dict) -> float:
        delay = self.bias
        for key, value in features.items():
            delay += self.weights.get(key, 0) * value
        return max(delay, 0.0)
