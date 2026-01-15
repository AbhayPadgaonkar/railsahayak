from backend.domain.trains import TrainProfile


def build_delay_features(
    profile: TrainProfile,
    gradient,
    condition=None,
):
    return {
        "sectional_speed": profile.max_permissible_speed,
        "priority": profile.priority,
        "is_goods": 1 if profile.train_type.name == "GOODS" else 0,
        "gradient_severity": 1 if gradient and gradient.value <= 200 else 0,
        "fog": 1 if condition == "FOG" else 0,
    }
