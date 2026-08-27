from backend.domain.trains import TrainProfile


def build_delay_features(
    profile: TrainProfile,
    gradient,
    condition=None,
):
    """Build the feature vector used by the delay predictor.

    Includes main effects, weather condition encodings, and interaction terms
    so the linear model can capture non-linear effects such as fog being more
    punishing at higher speeds or goods trains struggling on gradients.
    """
    is_goods = 1 if profile.train_type.name == "GOODS" else 0
    gradient_severity = 1 if gradient and gradient.value <= 200 else 0
    gradient_value = gradient.value if gradient else 0

    condition = (condition or "").upper()
    fog = 1 if condition == "FOG" else 0
    rain = 1 if condition == "RAIN" else 0
    storm = 1 if condition == "STORM" else 0
    thunderstorm = 1 if condition == "THUNDERSTORM" else 0

    return {
        "sectional_speed": profile.max_permissible_speed,
        "priority": profile.priority,
        "is_goods": is_goods,
        "gradient_severity": gradient_severity,
        "gradient_value": gradient_value,
        "fog": fog,
        "rain": rain,
        "storm": storm,
        "thunderstorm": thunderstorm,
        "goods_gradient": is_goods * gradient_severity,
        "fog_speed": fog * profile.max_permissible_speed,
    }
