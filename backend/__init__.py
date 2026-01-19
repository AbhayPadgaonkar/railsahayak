from backend.rules.signals import check_signal_permission
from backend.rules.tracks import check_line_entry, check_fouling
from backend.rules.speed import determine_speed_limit
from backend.rules.emergency import emergency_mode_decision

from backend.api.sensors_api import router as sensor_router
from backend.domain.trains import TrainType, build_train_profile
from backend.ml.delay_predictor import DelayPredictor
from backend.ml.feature_builder import build_delay_features
from backend.optimizer.section_optimizer import optimize_train_order