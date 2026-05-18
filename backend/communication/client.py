import json
import socket
import threading
import uuid
from datetime import datetime, timezone


ALLOWED_TYPES = {
	"CHAT",
	"SIGNAL_CLEARANCE_REQUEST",
	"SIGNAL_CLEARANCE_REPLY",
	"LINE_ENTRY_REQUEST",
	"LINE_ENTRY_REPLY",
	"BLOCK_RELEASE_NOTICE",
	"ROUTE_SET_REQUEST",
	"ROUTE_SET_CONFIRMED",
	"TURNOUT_CONFLICT_ALERT",
	"FOULING_ALERT",
	"FOULING_CLEAR",
	"SPEED_RESTRICTION_NOTICE",
	"EMERGENCY_DECLARATION",
	"EMERGENCY_CLEAR",
	"PRIORITY_OVERRIDE_NOTICE",
	"OPTIMIZED_ORDER_BROADCAST",
	"SENSOR_STATUS_UPDATE",
}


def send_json(conn: socket.socket, payload: dict):
	data = (json.dumps(payload) + "\n").encode("utf-8")
	conn.sendall(data)


def read_json_lines(conn: socket.socket):
	buffer = b""
	while True:
		chunk = conn.recv(4096)
		if not chunk:
			break
		buffer += chunk
		while b"\n" in buffer:
			line, _, buffer = buffer.partition(b"\n")
			line = line.strip()
			if line:
				yield json.loads(line.decode("utf-8"))


def listen_loop(conn: socket.socket):
	for msg in read_json_lines(conn):
		print("\n<", json.dumps(msg, indent=2))


def start_client(
	controller_id: str,
	name: str,
	section: str,
	host: str = "127.0.0.1",
	port: int = 8001,
):
	conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	conn.connect((host, port))

	send_json(
		conn,
		{
			"type": "HANDSHAKE",
			"controller_id": controller_id,
			"name": name,
			"section": section,
		},
	)

	listener = threading.Thread(target=listen_loop, args=(conn,), daemon=True)
	listener.start()

	print("Connected. Commands:")
	print("  <to_controller_id> <text>")
	print("  <TYPE> <to_controller_id> <text>")
	print("  { ... }  (send raw JSON)")
	while True:
		raw = input("> ").strip()
		if not raw:
			continue
		if raw.lower() in {"exit", "quit"}:
			break

		if raw.startswith("{"):
			try:
				payload = json.loads(raw)
			except json.JSONDecodeError:
				print("Invalid JSON")
				continue
			send_json(conn, payload)
			continue

		if " " not in raw:
			print("Format: <to_controller_id> <text> OR <TYPE> <to_controller_id> <text>")
			continue

		parts = raw.split(" ", 2)
		if len(parts) < 2:
			print("Format: <to_controller_id> <text> OR <TYPE> <to_controller_id> <text>")
			continue

		candidate = parts[0].upper()
		if candidate in ALLOWED_TYPES:
			if len(parts) < 3:
				print("Format: <TYPE> <to_controller_id> <text>")
				continue
			msg_type = candidate
			to_id = parts[1]
			text = parts[2]
		else:
			msg_type = "CHAT"
			to_id = parts[0]
			text = " ".join(parts[1:])

		send_json(
			conn,
			{
				"type": msg_type,
				"msg_id": str(uuid.uuid4()),
				"timestamp": datetime.now(timezone.utc).isoformat(),
				"to_controller_id": to_id,
				"text": text,
				"requires_ack": True,
			},
		)

	conn.close()


if __name__ == "__main__":
	# Example: start_client("CTRL-101", "R. Sharma", "VR-ST")
	start_client("CTRL-101", "R. Sharma", "VR-ST")
