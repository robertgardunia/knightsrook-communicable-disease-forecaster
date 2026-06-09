import time
from fastapi import APIRouter
from app.db import get_pool

router = APIRouter()
_start = time.time()


@router.get("/health")
async def health():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.fetchval("SELECT 1")
    return {"success": True, "data": {"db": "ok", "uptime": round(time.time() - _start)}, "error": None}
