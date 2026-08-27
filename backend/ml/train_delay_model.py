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


# Edge-case coverage: every train type, representative speeds, with/without fog,
# and gradients that straddle the 200-value severity threshold used by
# `build_delay_features`. These deterministic rows guarantee the model sees the
# full input envelope, then random samples fill out the bulk of the dataset.
_EDGE_SPEEDS = [30, 80, 130]
_EDGE_GRADIENTS = [None, 50, 150, 200, 201, 400]
_EDGE_CONDITIONS = [None, "FOG"]


def _edge_case_rows(rng: np.random.Generator):
    """Return a deterministic set of boundary samples."""
    rows = []
    for train_type in TrainType:
        for speed in _EDGE_SPEEDS:
            profile = build_train_profile("T", train_type, speed)
            for condition in _EDGE_CONDITIONS:
                for gradient_value in _EDGE_GRADIENTS:
                    gradient = (
                        SimpleNamespace(value=gradient_value)
                        if gradient_value is not None
                        else None
                    )
                    features = build_delay_features(profile, gradient, condition)
                    delay = _true_delay(speed, profile.priority, features, rng)
                    rows.append((features, delay))
    return rows


def _true_delay(speed: int, priority: int, features: dict, rng: np.random.Generator) -> float:
    """Synthetic delay generating process (minutes)."""
    delay = (
        16.0
        - 0.06 * speed
        - 0.00025 * speed * speed
        + 1.3 * priority
        + 4.0 * features["is_goods"]
        + 3.5 * features["gradient_severity"]
        + 7.0 * features["fog"]
        + rng.normal(0.0, 1.2)
    )
    return max(delay, 0.0)


def _generate_dataset(n_samples: int = 20000, seed: int = 42):
    """Return a list of (features, delay_minutes) tuples.

    The dataset mixes deterministic edge cases with random samples so the model
    sees the full feature envelope (minimum/maximum speed, all train types,
    gradients above/below the severity threshold, fog and clear conditions)
    while still learning from a broad distribution.
    """
    rng = np.random.default_rng(seed)
    train_types = list(TrainType)
    conditions = [None, "FOG", "RAIN", "STORM"]
    data = _edge_case_rows(rng)

    while len(data) < n_samples:
        train_type = train_types[int(rng.integers(0, len(train_types)))]
        speed = int(rng.integers(30, 131))
        profile = build_train_profile("T", train_type, speed)

        condition = conditions[int(rng.integers(0, len(conditions)))]
        has_gradient = rng.random() < 0.6
        # Bias gradient values towards the severity threshold to improve coverage.
        if has_gradient:
            if rng.random() < 0.3:
                gradient_value = int(rng.integers(50, 201))
            else:
                gradient_value = int(rng.integers(201, 451))
        else:
            gradient_value = 0
        gradient = SimpleNamespace(value=gradient_value) if has_gradient else None

        features = build_delay_features(profile, gradient, condition)
        delay = _true_delay(speed, profile.priority, features, rng)
        data.append((features, delay))

    return data


def train_model(n_samples: int = 20000, seed: int = 42) -> dict:
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
