import asyncio
import json
from fastapi import WebSocket, WebSocketDisconnect
from app.events import subscribe


async def dashboard_ws(websocket: WebSocket):
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue()

    async def _listen():
        async for event in subscribe("*"):
            await queue.put(event)

    listener = asyncio.create_task(_listen())
    try:
        while True:
            event = await queue.get()
            await websocket.send_text(json.dumps(event))
    except WebSocketDisconnect:
        pass
    finally:
        listener.cancel()
