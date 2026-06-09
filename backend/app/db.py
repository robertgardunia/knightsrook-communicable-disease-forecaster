import asyncpg
from app.config import settings


async def _init_conn(conn):
    await conn.execute("LOAD 'age'")
    await conn.execute("SET search_path = ag_catalog, \"$user\", public")


_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            host=settings.postgres_host,
            port=settings.postgres_port,
            user=settings.postgres_user,
            password=settings.postgres_pass,
            database=settings.postgres_db,
            init=_init_conn,
        )
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
