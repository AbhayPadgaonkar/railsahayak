from enum import Enum
from dataclasses import dataclass


class TrainType(Enum):
    VANDE_BHARAT = "VANDE_BHARAT"
    RAJDHANI = "RAJDHANI"
    SHATABDI = "SHATABDI"
    MAIL_EXPRESS = "MAIL_EXPRESS"
    PASSENGER = "PASSENGER"
    MEMU = "MEMU"
    GOODS = "GOODS"
    DEPARTMENTAL = "DEPARTMENTAL"


TRAIN_PRIORITY = {
    TrainType.VANDE_BHARAT: 1,
    TrainType.RAJDHANI: 2,
    TrainType.SHATABDI: 3,
    TrainType.MAIL_EXPRESS: 4,
    TrainType.PASSENGER: 5,
    TrainType.MEMU: 6,
    TrainType.GOODS: 7,
    TrainType.DEPARTMENTAL: 8,
}


@dataclass
class TrainProfile:
    train_id: str
    train_type: TrainType
    max_permissible_speed: int
    priority: int


def build_train_profile(train_id: str, train_type: TrainType, max_speed: int):
    return TrainProfile(
        train_id=train_id,
        train_type=train_type,
        max_permissible_speed=max_speed,
        priority=TRAIN_PRIORITY[train_type],
    )
