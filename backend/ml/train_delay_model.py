"""Train the advisory delay predictor from a synthetic labelled dataset.

The model is a plain linear regression over the features emitted by
`build_delay_features`: sectional_speed, priority, is_goods,
gradient_severity, and fog.  A synthetic dataset is generated from a
plausible delay-generating process, then fitted with numpy least-squares.
The resulting weights and bias are written to `delay_model.json` next to
this script so the predictor can load them at runtime.
"""

import json
from pathlib import Path
from types import SimpleNamespace

import numpy as np

from backend.domain.trains import TrainType, build_train_profile
from backend.ml.feature_builder import build_delay_features

FEATURES = [
    "sectional_speed",
    "priority",
    "is_goods",
    "gradient_severity",
    "fog",
]


def _generate_dataset(n_samples: int = 3000, seed: int = 42):
    """Return a list of (features, delay_minutes) tuples.

    The generative formula is intentionally non-identical to the linear model
    (it includes a small quadratic speed term and noise) so the fitted model
    learns a robust approximation rather than regurgitating the formula.
    """
    rng = np.random.default_rng(seed)
    train_types = list(TrainType)
    conditions = [None, "FOG"]
    data = []

    for _ in range(n_samples):
        train_type = train_types[int(rng.integers(0, len(train_types)))]
        speed = int(rng.integers(30, 131))
        profile = build_train_profile("T", train_type, speed)

        condition = conditions[int(rng.integers(0, len(conditions)))]
        has_gradient = rng.random() < 0.6
        gradient_value = int(rng.integers(50, 451)) if has_gradient else 0
        gradient = SimpleNamespace(value=gradient_value) if has_gradient else None

        features = build_delay_features(profile, gradient, condition)

        # Synthetic delay generating process (minutes). Higher priority trains
        # (lower numeric priority value) are faster; goods, gradients and fog
        # add delay. Speed gives a non-linear benefit at higher values.
        delay = (
            16.0
            - 0.06 * speed
            - 0.00025 * speed * speed
            + 1.3 * profile.priority
            + 4.0 * features["is_goods"]
            + 3.5 * features["gradient_severity"]
            + 7.0 * features["fog"]
            + rng.normal(0.0, 1.2)
        )
        delay = max(delay, 0.0)
        data.append((features, float(delay)))

    return data


def train_model(n_samples: int = 3000, seed: int = 42) -> dict:
    """Fit a linear regression and return {"bias": float, "weights": dict}."""
    data = _generate_dataset(n_samples, seed)

    # Design matrix with a leading column of 1s for the bias term.
    X = np.array([[1.0] + [features[f] for f in FEATURES] for features, _ in data])
    y = np.array([delay for _, delay in data])

    coeffs, *_ = np.linalg.lstsq(X, y, rcond=None)

    bias = float(coeffs[0])
    weights = {name: float(coeff) for name, coeff in zip(FEATURES, coeffs[1:])}
    return {"bias": bias, "weights": weights}


def save_model(model: dict, path: Path | None = None) -> Path:
    if path is None:
        path = Path(__file__).with_name("delay_model.json")
    path.write_text(json.dumps(model, indent=2), encoding="utf-8")
    return path


if __name__ == "__main__":
    model = train_model()
    out = save_model(model)
    print(f"Trained delay model saved to {out}")
    print(f"  bias={model['bias']:.4f}")
    for name, value in model["weights"].items():
        print(f"  {name}={value:.4f}")
