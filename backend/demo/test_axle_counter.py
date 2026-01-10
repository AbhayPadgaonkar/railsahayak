from backend.simulation.axle_counter import AxleCounterBlock

block = AxleCounterBlock("upMain_1")

print("Initial:", block.occupied)

block.axle_enter(axles=16)
print("After enter:", block.occupied)

block.axle_exit(axles=16)
print("After exit:", block.occupied)
