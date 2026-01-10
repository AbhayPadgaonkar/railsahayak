from backend.simulation.sensor_state import SensorState

ss = SensorState()
ss.add_block("upMain_1")
ss.add_track("platform_1")

ss.blocks["upMain_1"].axle_enter(16)
ss.tracks["platform_1"].shunt()

print(ss.snapshot())
