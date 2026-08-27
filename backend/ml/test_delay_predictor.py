from types import SimpleNamespace

import pytest

from backend.domain.trains import TrainType, build_train_profile
from backend.ml.delay_predictor import DelayPredictor
from backend.ml.feature_builder import build_delay_features


@pytest.fixture(autouse=True)
def _isolated_db():
    """Override the root autouse DB fixture; ML tests do not need PostgreSQL."""
    yield


def _features(
    train_type: TrainType,
    speed: int,
    gradient_value: int | None = None,
    condition: str | None = None,
):
    profile = build_train_profile("T", train_type, speed)
    gradient = SimpleNamespace(value=gradient_value) if gradient_value is not None else None
    return build_delay_features(profile, gradient, condition)


def test_predictor_loads_trained_model():
    predictor = DelayPredictor()
    expected = {
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
    }
    assert expected.issubset(set(predictor.weights))
    assert isinstance(predictor.bias, float)


def test_prediction_is_non_negative():
    predictor = DelayPredictor()
    features = _features(TrainType.PASSENGER, 130)
    assert predictor.predict(features) >= 0.0


def test_fog_increases_predicted_delay():
    predictor = DelayPredictor()
    clear = _features(TrainType.MAIL_EXPRESS, 100)
    foggy = _features(TrainType.MAIL_EXPRESS, 100, condition="FOG")
    assert predictor.predict(foggy) > predictor.predict(clear)


def test_rain_and_storm_increase_predicted_delay():
    predictor = DelayPredictor()
    clear = _features(TrainType.MAIL_EXPRESS, 100)
    rain = _features(TrainType.MAIL_EXPRESS, 100, condition="RAIN")
    storm = _features(TrainType.MAIL_EXPRESS, 100, condition="STORM")
    thunderstorm = _features(TrainType.MAIL_EXPRESS, 100, condition="THUNDERSTORM")
    assert predictor.predict(rain) > predictor.predict(clear)
    assert predictor.predict(storm) > predictor.predict(rain)
    assert predictor.predict(thunderstorm) > predictor.predict(storm)


def test_goods_train_has_higher_delay_than_express():
    predictor = DelayPredictor()
    express = _features(TrainType.MAIL_EXPRESS, 100)
    goods = _features(TrainType.GOODS, 100)
    assert predictor.predict(goods) > predictor.predict(express)


def test_higher_speed_reduces_predicted_delay():
    predictor = DelayPredictor()
    slow = _features(TrainType.PASSENGER, 50)
    fast = _features(TrainType.PASSENGER, 120)
    assert predictor.predict(fast) < predictor.predict(slow)


def test_gradient_severity_increases_delay():
    predictor = DelayPredictor()
    flat = _features(TrainType.MAIL_EXPRESS, 100)
    gradient = _features(TrainType.MAIL_EXPRESS, 100, gradient_value=150)
    assert predictor.predict(gradient) > predictor.predict(flat)


def test_gradient_value_continuous_effect():
    """Within the severe band, a larger gradient value adds more delay."""
    predictor = DelayPredictor()
    low = _features(TrainType.MAIL_EXPRESS, 100, gradient_value=100)
    high = _features(TrainType.MAIL_EXPRESS, 100, gradient_value=200)
    assert predictor.predict(high) > predictor.predict(low)


def test_gradient_severity_threshold_at_200():
    """A gradient value of 200 is flagged as severe; 201 is not."""
    predictor = DelayPredictor()
    severity = _features(TrainType.MAIL_EXPRESS, 100, gradient_value=200)
    non_severe = _features(TrainType.MAIL_EXPRESS, 100, gradient_value=201)
    assert predictor.predict(severity) > predictor.predict(non_severe)


def test_goods_gradient_interaction():
    """Goods trains on a severe gradient are penalised more than expresses."""
    predictor = DelayPredictor()
    express = _features(TrainType.MAIL_EXPRESS, 100, gradient_value=150)
    goods = _features(TrainType.GOODS, 100, gradient_value=150)
    assert predictor.predict(goods) > predictor.predict(express)


def test_fog_speed_interaction():
    """Fog at high speed adds more delay than fog at low speed."""
    predictor = DelayPredictor()
    slow_fog = _features(TrainType.MAIL_EXPRESS, 40, condition="FOG")
    fast_fog = _features(TrainType.MAIL_EXPRESS, 120, condition="FOG")
    assert predictor.predict(fast_fog) > predictor.predict(slow_fog)
