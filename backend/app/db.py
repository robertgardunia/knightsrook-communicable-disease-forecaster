import asyncio
import logging
import asyncpg
from app.config import settings

logger = logging.getLogger(__name__)


async def _init_conn(conn):
    await conn.execute("LOAD 'age'")
    await conn.execute("SET search_path = ag_catalog, \"$user\", public")


_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        for attempt in range(1, 11):
            try:
                _pool = await asyncpg.create_pool(
                    host=settings.postgres_host,
                    port=settings.postgres_port,
                    user=settings.postgres_user,
                    password=settings.postgres_pass,
                    database=settings.postgres_db,
                    init=_init_conn,
                )
                logger.info("db pool connected on attempt %d", attempt)
                break
            except Exception as exc:
                logger.warning("db connect attempt %d failed: %s", attempt, exc)
                if attempt == 10:
                    raise
                await asyncio.sleep(3)
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
