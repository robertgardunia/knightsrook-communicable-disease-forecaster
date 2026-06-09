from fastapi import APIRouter, BackgroundTasks
from app.db import get_pool
from app.ingest import gpei

router = APIRouter(prefix="/ingest")

SOURCES = {"gpei"}


@router.post("/{source}")
async def trigger_ingest(source: str, background_tasks: BackgroundTasks):
    if source not in SOURCES:
        return {"success": False, "data": None, "error": f"Unknown source: {source}. Valid: {sorted(SOURCES)}"}
    pool = await get_pool()
    if source == "gpei":
        background_tasks.add_task(gpei.ingest_all, pool)
    return {"success": True, "data": {"status": "started", "source": source}, "error": None}


@router.get("/status")
async def ingest_status():
    pool = await get_pool()
    async with pool.acquire() as conn:
        districts = await conn.fetchval("SELECT COUNT(*) FROM substrate.gpei_districts")
        cases = await conn.fetchval("SELECT COUNT(*) FROM substrate.wpv_cases")
        grace = await conn.fetchval("SELECT COUNT(*) FROM substrate.grace_groundwater")
        displacement = await conn.fetchval("SELECT COUNT(*) FROM substrate.displacement_data")
        last_ingest = await conn.fetchval(
            "SELECT MAX(ingested_at) FROM substrate.wpv_cases"
        )
    return {
        "success": True,
        "data": {
            "gpei_districts": districts,
            "wpv_cases": cases,
            "grace_groundwater_records": grace,
            "displacement_records": displacement,
            "last_ingest": last_ingest.isoformat() if last_ingest else None,
        },
        "error": None,
    }
