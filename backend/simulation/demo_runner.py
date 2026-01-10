import time
from sensor_state import SensorState

sensor_state = SensorState()

sensor_state.add_block("upMain_1")
sensor_state.add_block("upMain_2")
sensor_state.add_track("platform_1")

block = sensor_state.blocks["upMain_1"]
track = sensor_state.tracks["platform_1"]

# Train enters block
block.axle_enter(axles=16)
print(sensor_state.snapshot())
time.sleep(2)

# Train occupies platform
track.shunt()
print(sensor_state.snapshot())
time.sleep(2)

# Train clears block
block.axle_exit(axles=16)
track.clear()
print(sensor_state.snapshot())
