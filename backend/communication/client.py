import json
import socket
import threading
import uuid
from datetime import datetime, timezone


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

	print("Connected. Type messages as: <to_controller_id> <text>")
	while True:
		raw = input("> ").strip()
		if not raw:
			continue
		if raw.lower() in {"exit", "quit"}:
			break

		if " " not in raw:
			print("Format: <to_controller_id> <text>")
			continue

		to_id, text = raw.split(" ", 1)
		send_json(
			conn,
			{
				"type": "CHAT",
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
