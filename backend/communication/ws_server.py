import asyncio
import json
from dataclasses import dataclass
from typing import Dict, Optional

import websockets
from websockets.server import WebSocketServerProtocol


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


@dataclass
class ControllerSession:
    controller_id: str
    name: str
    section: str
    ws: WebSocketServerProtocol


class ControllerHub:
    def __init__(self):
        self._sessions: Dict[str, ControllerSession] = {}

    def register(self, session: ControllerSession):
        self._sessions[session.controller_id] = session

    def unregister(self, controller_id: str):
        self._sessions.pop(controller_id, None)

    def get(self, controller_id: str) -> Optional[ControllerSession]:
        return self._sessions.get(controller_id)


hub = ControllerHub()


def build_error(reason: str) -> str:
    return json.dumps({"type": "ERROR", "reason": reason})


async def handle_client(ws: WebSocketServerProtocol):
    controller_id = None
    try:
        raw = await ws.recv()
        hello = json.loads(raw)
        if hello.get("type") != "HANDSHAKE":
            await ws.send(build_error("Handshake required"))
            return

        controller_id = hello.get("controller_id")
        name = hello.get("name", "Unknown")
        section = hello.get("section", "UNKNOWN")
        if not controller_id:
            await ws.send(build_error("controller_id missing"))
            return

        session = ControllerSession(
            controller_id=controller_id,
            name=name,
            section=section,
            ws=ws,
        )
        hub.register(session)
        await ws.send(json.dumps({"type": "HANDSHAKE_ACK", "controller_id": controller_id}))

        peers = [
            {"controller_id": s.controller_id, "name": s.name, "section": s.section}
            for cid, s in hub._sessions.items()
            if cid != controller_id
        ]
        await ws.send(json.dumps({"type": "PRESENCE", "peers": peers}))

        async for raw in ws:
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send(build_error("Invalid JSON"))
                continue

            msg_type = message.get("type")
            if msg_type not in ALLOWED_TYPES:
                await ws.send(build_error("Unsupported type"))
                continue

            if msg_type not in DIRECT_TYPES:
                await ws.send(build_error("Direct type required"))
                continue

            to_id = message.get("to_controller_id")
            if not to_id:
                await ws.send(build_error("to_controller_id missing"))
                continue

            target = hub.get(to_id)
            if not target:
                await ws.send(build_error(f"Controller {to_id} not connected"))
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
            await target.ws.send(json.dumps(relay))

            if message.get("requires_ack"):
                await ws.send(
                    json.dumps(
                        {
                            "type": "ACK",
                            "msg_id": message.get("msg_id"),
                            "to_controller_id": to_id,
                        }
                    )
                )
    except websockets.ConnectionClosed:
        pass
    finally:
        if controller_id:
            hub.unregister(controller_id)


async def main(host: str = "0.0.0.0", port: int = 8001):
    async with websockets.serve(handle_client, host, port):
        print(f"WebSocket controller hub listening on {host}:{port}")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
