import json
import socket
import threading
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class ControllerSession:
	controller_id: str
	name: str
	section: str
	conn: socket.socket


class ControllerHub:
	def __init__(self):
		self._lock = threading.Lock()
		self._sessions: Dict[str, ControllerSession] = {}

	def register(self, session: ControllerSession):
		with self._lock:
			self._sessions[session.controller_id] = session

	def unregister(self, controller_id: str):
		with self._lock:
			self._sessions.pop(controller_id, None)

	def get(self, controller_id: str) -> Optional[ControllerSession]:
		with self._lock:
			return self._sessions.get(controller_id)


hub = ControllerHub()

ALLOWED_TYPES = {
	"HANDSHAKE",
	"HANDSHAKE_ACK",
	"CHAT",
	"ACK",
	"ERROR",
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

DIRECT_TYPES = ALLOWED_TYPES - {"HANDSHAKE", "HANDSHAKE_ACK", "ERROR"}


def send_json(conn: socket.socket, payload: dict):
	data = (json.dumps(payload) + "\n").encode("utf-8")
	conn.sendall(data)


def read_json_line(conn: socket.socket) -> Optional[dict]:
	buffer = b""
	while True:
		chunk = conn.recv(4096)
		if not chunk:
			return None
		buffer += chunk
		if b"\n" in buffer:
			line, _, rest = buffer.partition(b"\n")
			buffer = rest
			line = line.strip()
			if not line:
				continue
			return json.loads(line.decode("utf-8"))


def handle_client(conn: socket.socket, addr):
	controller_id = None
	try:
		hello = read_json_line(conn)
		if not hello or hello.get("type") != "HANDSHAKE":
			send_json(conn, {"type": "ERROR", "reason": "Handshake required"})
			return

		controller_id = hello.get("controller_id")
		name = hello.get("name", "Unknown")
		section = hello.get("section", "UNKNOWN")

		if not controller_id:
			send_json(conn, {"type": "ERROR", "reason": "controller_id missing"})
			return

		session = ControllerSession(
			controller_id=controller_id,
			name=name,
			section=section,
			conn=conn,
		)
		hub.register(session)
		send_json(conn, {"type": "HANDSHAKE_ACK", "controller_id": controller_id})

		while True:
			message = read_json_line(conn)
			if not message:
				break

			msg_type = message.get("type")
			if msg_type not in ALLOWED_TYPES:
				send_json(conn, {"type": "ERROR", "reason": "Unsupported type"})
				continue

			if msg_type not in DIRECT_TYPES:
				send_json(conn, {"type": "ERROR", "reason": "Direct type required"})
				continue

			to_id = message.get("to_controller_id")
			if not to_id:
				send_json(conn, {"type": "ERROR", "reason": "to_controller_id missing"})
				continue

			target = hub.get(to_id)
			if not target:
				send_json(
					conn,
					{"type": "ERROR", "reason": f"Controller {to_id} not connected"},
				)
				continue

			relay = {
				"type": msg_type,
				"from_controller_id": controller_id,
				"from_name": name,
				"from_section": section,
				"to_controller_id": to_id,
				"text": message.get("text", ""),
				"timestamp": message.get("timestamp"),
				"msg_id": message.get("msg_id"),
				"priority": message.get("priority", "ROUTINE"),
				"context": message.get("context", {}),
			}
			send_json(target.conn, relay)

			if message.get("requires_ack"):
				send_json(
					conn,
					{
						"type": "ACK",
						"msg_id": message.get("msg_id"),
						"to_controller_id": to_id,
					},
				)
	except Exception as exc:
		try:
			send_json(conn, {"type": "ERROR", "reason": str(exc)})
		except Exception:
			pass
	finally:
		if controller_id:
			hub.unregister(controller_id)
		try:
			conn.close()
		except Exception:
			pass


def start_server(host: str = "0.0.0.0", port: int = 8001):
	server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
	server.bind((host, port))
	server.listen(5)
	print(f"TCP controller hub listening on {host}:{port}")

	while True:
		conn, addr = server.accept()
		thread = threading.Thread(target=handle_client, args=(conn, addr), daemon=True)
		thread.start()


if __name__ == "__main__":
	start_server()
