"""Generate a realistic 24-hour wall-clock timetable for the prototype line.

Run:  python backend/config/timetables/gen_realtime.py
Writes: backend/config/timetables/realtime_timetable.json
"""
import json
import random
from pathlib import Path

random.seed(42)

TYPES = {
    "VANDE_BHARAT":  {"speed": 130, "priority": 1, "stops": []},
    "RAJDHANI":      {"speed": 110, "priority": 2, "stops": []},
    "SHATABDI":      {"speed": 130, "priority": 3, "stops": []},
    "MAIL_EXPRESS":  {"speed": 100, "priority": 4, "stops": []},
    "PASSENGER":     {"speed": 90,  "priority": 5, "stops": []},
    "MEMU":          {"speed": 80,  "priority": 6, "stops": []},
    "GOODS":         {"speed": 60,  "priority": 7, "stops": []},
}

# Station blocks for stops (passenger trains stop at 1-2 intermediate stations)
STOPS = {
    "UP_MAIN": [
        ["ST_A2_BC"],
        ["ST_B1_BC"],
        ["ST_B2_BC"],
        ["ST_C1_BC"],
    ],
    "DN_MAIN": [
        ["ST_C1_BC"],
        ["ST_B2_BC"],
        ["ST_B1_BC"],
        ["ST_A2_BC"],
    ],
}

# Indian Railways-style train number pools per type
ID_POOLS = {
    "VANDE_BHARAT": [22435, 22436, 20901, 20902, 22425, 22426],
    "RAJDHANI":     [12301, 12302, 12951, 12952, 12953, 12954, 12431, 12432],
    "SHATABDI":     [12009, 12010, 12025, 12026, 12027, 12028],
    "MAIL_EXPRESS": [12625, 12626, 12611, 12612, 12723, 12724, 12735, 12736,
                     11013, 11014, 11019, 11020],
    "PASSENGER":    [15003, 15004, 15005, 15006, 15007, 15008,
                     55001, 55002, 55003, 55004],
    "MEMU":         [14003, 14004, 14005, 14006, 64001, 64002],
    "GOODS":        [13501, 13502, 13503, 13504, 13505, 13506,
                     13507, 13508, 13509, 13510],
}

# Which types run in each hour band  (hour -> list of types)
BANDS = {
    # 00-05: freight dominant, occasional passenger
    **{h: ["GOODS", "GOODS", "MAIL_EXPRESS"] for h in range(5)},
    # 05-07: morning ramp-up
    5: ["GOODS", "MEMU", "PASSENGER", "MAIL_EXPRESS"],
    6: ["VANDE_BHARAT", "RAJDHANI", "PASSENGER", "GOODS", "MEMU"],
    # 07-11: morning peak
    **{h: ["VANDE_BHARAT", "RAJDHANI", "SHATABDI", "MAIL_EXPRESS",
           "PASSENGER", "MEMU", "GOODS"] for h in range(7, 11)},
    # 11-14: midday
    **{h: ["RAJDHANI", "MAIL_EXPRESS", "PASSENGER", "MEMU", "GOODS"]
       for h in range(11, 14)},
    # 14-17: afternoon
    **{h: ["VANDE_BHARAT", "MAIL_EXPRESS", "PASSENGER", "MEMU", "GOODS"]
       for h in range(14, 17)},
    # 17-21: evening peak
    **{h: ["VANDE_BHARAT", "RAJDHANI", "SHATABDI", "MAIL_EXPRESS",
           "PASSENGER", "PASSENGER", "MEMU", "GOODS"] for h in range(17, 21)},
    # 21-24: wind-down
    21: ["RAJDHANI", "MAIL_EXPRESS", "PASSENGER", "GOODS"],
    22: ["MAIL_EXPRESS", "GOODS", "GOODS"],
    23: ["GOODS", "GOODS", "MAIL_EXPRESS"],
}

def hms(h: int, m: int) -> str:
    return f"{h:02d}:{m:02d}"

def make_stop_list(line_id: str, train_type: str) -> list[dict]:
    """Pick 0-2 intermediate stops based on train type."""
    if train_type in ("GOODS", "VANDE_BHARAT", "SHATABDI", "RAJDHANI"):
        return []
    pool = STOPS[line_id]
    n = random.choices([0, 1, 2], weights=[40, 40, 20])[0]
    chosen = random.sample(pool, min(n, len(pool)))
    return [{"block_id": b, "dwell_min": random.choice([1, 2, 3])} for b in chosen]

def generate() -> dict:
    trains = []
    id_counters = {t: 0 for t in ID_POOLS}

    for hour in range(24):
        band = BANDS.get(hour, ["GOODS"])
        # More trains per slot during peak
        n_trains = random.choices(
            [2, 3, 4, 5],
            weights=[20, 40, 30, 10] if hour in range(7, 11) or hour in range(17, 21)
            else [30, 40, 20, 10]
        )[0]

        # Spread trains across the hour
        minutes = sorted(random.sample(range(60), min(n_trains, 60)))

        for m in minutes:
            train_type = random.choice(band)
            spec = TYPES[train_type]
            line_id = random.choice(["UP_MAIN", "DN_MAIN"])

            # Delay: most trains on time, some delayed
            delay_min = 0
            if random.random() < 0.25:
                delay_min = random.choices(
                    [2, 5, 8, 12, 15],
                    weights=[40, 30, 15, 10, 5]
                )[0]

            pool = ID_POOLS[train_type]
            idx = id_counters[train_type] % len(pool)
            id_counters[train_type] += 1
            train_id = str(pool[idx])

            stops = make_stop_list(line_id, train_type)

            trains.append({
                "train_id": train_id,
                "train_type": train_type,
                "line_id": line_id,
                "scheduled_time": hms(hour, m),
                "speed_kmph": spec["speed"],
                "delay_min": delay_min,
                "stops": stops,
            })

    return {
        "section_id": "PROTO_LINE",
        "mode": "realtime",
        "schedule": trains,
    }

if __name__ == "__main__":
    tt = generate()
    out = Path(__file__).resolve().parent / "realtime_timetable.json"
    out.write_text(json.dumps(tt, indent=2), encoding="utf-8")
    print(f"Generated {len(tt['schedule'])} trains -> {out}")
