"""Train the advisory delay predictor from a synthetic labelled dataset.

The model is a plain linear regression over the features emitted by
`build_delay_features`: speed, priority, train type, gradient severity/value,
weather conditions, and interaction terms. A synthetic dataset is generated
from a plausible delay-generating process, then fitted with numpy
least-squares. The resulting weights and bias are written to
`delay_model.json` next to this script so the predictor can load them at
runtime.
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
    "gradient_value",
    "fog",
    "rain",
    "storm",
    "thunderstorm",
    "goods_gradient",
    "fog_speed",
]


# Edge-case coverage: every train type, representative speeds, all supported
# weather conditions, and gradients that straddle the 200-value severity
# threshold used by `build_delay_features`. These deterministic rows guarantee
# the model sees the full input envelope, then random samples fill out the
# bulk of the dataset.
_EDGE_SPEEDS = [30, 80, 130]
_EDGE_GRADIENTS = [None, 50, 150, 200, 201, 400]
_EDGE_CONDITIONS = [None, "FOG", "RAIN", "STORM", "THUNDERSTORM"]


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
    """Synthetic delay generating process (minutes).

    Includes main effects, a small quadratic speed penalty, weather condition
    effects, and interaction terms so the fitted linear model must learn from
    a richer signal than a purely additive formula.
    """
    delay = (
        16.0
        - 0.06 * speed
        - 0.00025 * speed * speed
        + 1.3 * priority
        + 4.0 * features["is_goods"]
        + 3.5 * features["gradient_severity"]
        + 0.005 * features["gradient_value"]
        + 5.0 * features["fog"]
        + 4.0 * features["rain"]
        + 6.0 * features["storm"]
        + 8.0 * features["thunderstorm"]
        + 2.5 * features["goods_gradient"]
        + 0.12 * features["fog_speed"]
        + rng.normal(0.0, 1.2)
    )
    return max(delay, 0.0)


def _generate_dataset(n_samples: int = 20000, seed: int = 42):
    """Return a list of (features, delay_minutes) tuples.

    The dataset mixes deterministic edge cases with random samples so the model
    sees the full feature envelope (minimum/maximum speed, all train types,
    gradients above/below the severity threshold, and all weather conditions)
    while still learning from a broad distribution.
    """
    rng = np.random.default_rng(seed)
    train_types = list(TrainType)
    conditions = [None, "FOG", "RAIN", "STORM", "THUNDERSTORM"]
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


def _fit(data: list[tuple[dict, float]]) -> tuple[float, dict[str, float]]:
    """Fit a linear regression and return (bias, weights)."""
    X = np.array([[1.0] + [features[f] for f in FEATURES] for features, _ in data])
    y = np.array([delay for _, delay in data])
    coeffs, *_ = np.linalg.lstsq(X, y, rcond=None)
    bias = float(coeffs[0])
    weights = {name: float(coeff) for name, coeff in zip(FEATURES, coeffs[1:])}
    return bias, weights


def _predict(data: list[tuple[dict, float]], bias: float, weights: dict[str, float]) -> np.ndarray:
    X = np.array([[1.0] + [features[f] for f in FEATURES] for features, _ in data])
    y_pred = X @ np.array([bias] + [weights[f] for f in FEATURES])
    return np.maximum(y_pred, 0.0)


def _metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    mse = float(np.mean((y_true - y_pred) ** 2))
    rmse = float(np.sqrt(mse))
    mae = float(np.mean(np.abs(y_true - y_pred)))
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
    return {"r2": r2, "rmse": rmse, "mae": mae}


def cross_validate(n_samples: int = 20000, seed: int = 42, folds: int = 5) -> dict:
    """Perform k-fold cross-validation and return per-fold and mean metrics."""
    data = _generate_dataset(n_samples, seed)
    rng = np.random.default_rng(seed)
    indices = np.arange(n_samples)
    rng.shuffle(indices)
    fold_size = n_samples // folds

    fold_metrics = []
    for i in range(folds):
        test_idx = indices[i * fold_size : (i + 1) * fold_size]
        train_idx = np.concatenate(
            [indices[: i * fold_size], indices[(i + 1) * fold_size :]]
        )
        train_data = [data[j] for j in train_idx]
        test_data = [data[j] for j in test_idx]
        bias, weights = _fit(train_data)
        y_true = np.array([d for _, d in test_data])
        y_pred = _predict(test_data, bias, weights)
        fold_metrics.append(_metrics(y_true, y_pred))

    mean_metrics = {
        key: float(np.mean([m[key] for m in fold_metrics]))
        for key in fold_metrics[0]
    }
    return {"folds": fold_metrics, "mean": mean_metrics}


def train_model(n_samples: int = 20000, seed: int = 42) -> dict:
    """Fit a linear regression on the full dataset and return the model."""
    data = _generate_dataset(n_samples, seed)
    bias, weights = _fit(data)
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

    print("\n5-fold cross-validation:")
    cv = cross_validate()
    for i, m in enumerate(cv["folds"], start=1):
        print(
            f"  fold {i}: R²={m['r2']:.4f} RMSE={m['rmse']:.4f} MAE={m['mae']:.4f}"
        )
    mean = cv["mean"]
    print(
        f"  mean:   R²={mean['r2']:.4f} RMSE={mean['rmse']:.4f} MAE={mean['mae']:.4f}"
    )
