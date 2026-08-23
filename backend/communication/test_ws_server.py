import asyncio
import json

import pytest
import websockets

from backend.communication import ws_server


@pytest.fixture(autouse=True)
def clear_hub():
    ws_server.hub._sessions.clear()
    yield
    ws_server.hub._sessions.clear()


async def run_server(port: int):
    server = await websockets.serve(ws_server.handle_client, "127.0.0.1", port)
    try:
        await asyncio.Future()
    finally:
        server.close()
        await server.wait_closed()


async def handshake(ws, controller_id: str, name: str = "Ctrl", section: str = "A"):
    await ws.send(
        json.dumps(
            {"type": "HANDSHAKE", "controller_id": controller_id, "name": name, "section": section}
        )
    )
    ack = json.loads(await asyncio.wait_for(ws.recv(), timeout=1))
    assert ack["type"] == "HANDSHAKE_ACK"
    assert ack["controller_id"] == controller_id
    return ack


@pytest.mark.asyncio
async def test_handshake_and_empty_presence():
    port = 8765
    task = asyncio.create_task(run_server(port))
    await asyncio.sleep(0.05)

    try:
        async with websockets.connect(f"ws://127.0.0.1:{port}") as ws:
            await handshake(ws, "CCG-VR")
            presence = json.loads(await asyncio.wait_for(ws.recv(), timeout=1))
            assert presence["type"] == "PRESENCE"
            assert presence["peers"] == []
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


@pytest.mark.asyncio
async def test_presence_includes_existing_peer():
    port = 8766
    task = asyncio.create_task(run_server(port))
    await asyncio.sleep(0.05)

    try:
        async with websockets.connect(f"ws://127.0.0.1:{port}") as ws_a:
            await handshake(ws_a, "CCG-VR", "Controller CCG-VR", "CCG-VR")
            presence_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=1))
            assert presence_a["peers"] == []

            async with websockets.connect(f"ws://127.0.0.1:{port}") as ws_b:
                await handshake(ws_b, "VR-VLSD", "Controller VR-VLSD", "VR-VLSD")
                presence_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=1))
                assert presence_b["type"] == "PRESENCE"
                assert len(presence_b["peers"]) == 1
                assert presence_b["peers"][0]["controller_id"] == "CCG-VR"
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


@pytest.mark.asyncio
async def test_peer_join_broadcast():
    port = 8767
    task = asyncio.create_task(run_server(port))
    await asyncio.sleep(0.05)

    try:
        async with websockets.connect(f"ws://127.0.0.1:{port}") as ws_a:
            await handshake(ws_a, "CCG-VR", "Controller CCG-VR", "CCG-VR")
            presence = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=1))
            assert presence["type"] == "PRESENCE"

            async with websockets.connect(f"ws://127.0.0.1:{port}") as ws_b:
                await handshake(ws_b, "VR-VLSD", "Controller VR-VLSD", "VR-VLSD")
                join = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=1))
                assert join["type"] == "PEER_JOIN"
                assert join["controller_id"] == "VR-VLSD"
                assert join["name"] == "Controller VR-VLSD"
                assert join["section"] == "VR-VLSD"
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


@pytest.mark.asyncio
async def test_peer_leave_broadcast():
    port = 8768
    task = asyncio.create_task(run_server(port))
    await asyncio.sleep(0.05)

    try:
        async with websockets.connect(f"ws://127.0.0.1:{port}") as ws_a:
            await handshake(ws_a, "CCG-VR", "Controller CCG-VR", "CCG-VR")
            presence = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=1))
            assert presence["type"] == "PRESENCE"

            ws_b = await websockets.connect(f"ws://127.0.0.1:{port}")
            try:
                await handshake(ws_b, "VR-VLSD", "Controller VR-VLSD", "VR-VLSD")
                join = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=1))
                assert join["type"] == "PEER_JOIN"
            finally:
                await ws_b.close()

            leave = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=1))
            assert leave["type"] == "PEER_LEAVE"
            assert leave["controller_id"] == "VR-VLSD"
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
