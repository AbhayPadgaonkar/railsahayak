from backend.simulation.track_circuit import TrackCircuit

tc = TrackCircuit("platform_1")

print("Initial:", tc.occupied)
tc.shunt()
print("After shunt:", tc.occupied)
tc.clear()
print("After clear:", tc.occupied)
