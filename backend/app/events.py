import asyncio
from collections import defaultdict
from typing import AsyncGenerator

_subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)


async def publish(event_type: str, payload: dict):
    for q in _subscribers[event_type]:
        await q.put({"type": event_type, "payload": payload})


async def subscribe(event_type: str) -> AsyncGenerator[dict, None]:
    q: asyncio.Queue = asyncio.Queue()
    _subscribers[event_type].append(q)
    try:
        while True:
            yield await q.get()
    finally:
        _subscribers[event_type].remove(q)
