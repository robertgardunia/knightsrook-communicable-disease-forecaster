import json
import logging
from datetime import date

import httpx
import asyncpg

logger = logging.getLogger(__name__)

GPEI_BASE = "https://services.arcgis.com/5T5nSi527N4F7luB/ArcGIS/rest/services"
PAGE_SIZE = 1000


async def _paginate(client: httpx.AsyncClient, service: str, where: str, out_fields: str, geometry: bool = True) -> list[dict]:
    features: list[dict] = []
    offset = 0
    while True:
        r = await client.get(
            f"{GPEI_BASE}/{service}/FeatureServer/0/query",
            params={
                "where": where,
                "outFields": out_fields,
                "returnGeometry": "true" if geometry else "false",
                "outSR": "4326",
                "f": "geojson" if geometry else "json",
                "resultRecordCount": PAGE_SIZE,
                "resultOffset": offset,
            },
            timeout=60,
        )
        r.raise_for_status()
        data = r.json()
        page = data.get("features", [])
        features.extend(page)
        logger.info("gpei paginate %s offset=%d got=%d", service, offset, len(page))
        if not data.get("exceededTransferLimit") or len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return features


async def ingest_districts(pool: asyncpg.Pool) -> int:
    """Fetch GLOBAL_POLIO_ADM2 for PK+AF and load into substrate.gpei_districts."""
    async with httpx.AsyncClient() as client:
        features = await _paginate(
            client,
            "GLOBAL_POLIO_ADM2",
            "ISO_2_CODE IN ('PK','AF')",
            "OBJECTID,ISO_2_CODE,ADM2_NAME,ADM1_NAME,ADM0_NAME,"
            "ADM2_CODE,ADM1_CODE,ADM0_CODE,WHO_REGION,"
            "CENTER_LON,CENTER_LAT,GlobalID,ADM2_VIZ_NAME,ADM1_VIZ_NAME,ADM0_VIZ_NAME",
            geometry=True,
        )

    async with pool.acquire() as conn:
        await conn.execute("TRUNCATE substrate.gpei_districts RESTART IDENTITY")
        for feat in features:
            p = feat.get("properties") or {}
            geom = feat.get("geometry")
            if not geom:
                continue
            await conn.execute(
                """
                INSERT INTO substrate.gpei_districts
                    (objectid, iso2, adm0_name, adm1_name, adm2_name,
                     adm2_code, adm1_code, adm0_code, who_region,
                     center_lon, center_lat, gpei_guid,
                     adm2_viz_name, adm1_viz_name, adm0_viz_name, geom)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
                        ST_SetSRID(ST_GeomFromGeoJSON($16), 4326))
                """,
                p.get("OBJECTID"), p.get("ISO_2_CODE"),
                p.get("ADM0_NAME"), p.get("ADM1_NAME"), p.get("ADM2_NAME"),
                p.get("ADM2_CODE"), p.get("ADM1_CODE"), p.get("ADM0_CODE"),
                p.get("WHO_REGION"), p.get("CENTER_LON"), p.get("CENTER_LAT"),
                p.get("GlobalID"),
                p.get("ADM2_VIZ_NAME"), p.get("ADM1_VIZ_NAME"), p.get("ADM0_VIZ_NAME"),
                json.dumps(geom),
            )

    logger.info("gpei districts ingested count=%d", len(features))
    return len(features)


async def ingest_wpv_cases(pool: asyncpg.Pool) -> int:
    """Fetch GLOBAL_WPV_CASES for PK+AF and load into substrate.wpv_cases."""
    async with httpx.AsyncClient() as client:
        features = await _paginate(
            client,
            "GLOBAL_WPV_CASES",
            "Admin0Iso2 IN ('PK','AF')",
            "EPID,Admin0Iso2,Admin0Offi,Admin1Offi,Admin2Offi,"
            "Admin0GUID,Admin1GUID,Admin2GUID,Classifica,"
            "WILD1,WILD2,WILD3,VDPV1,VDPV2,VDPV3,"
            "DateOfOnse,DateOfOn_1,Latitude,Longitude,"
            "DosesOPVRo,DosesOPVSI,DosesTotal,"
            "Surveillan,VirusGenoT,VirusClust,WhoRegion,WildPolioC,AFPCase_Co",
            geometry=False,
        )

    async with pool.acquire() as conn:
        await conn.execute("TRUNCATE substrate.wpv_cases RESTART IDENTITY")
        for feat in features:
            p = feat.get("attributes") or feat.get("properties") or {}
            year = p.get("DateOfOnse")
            month = int(p.get("DateOfOn_1") or 1)
            onset: date | None = None
            if year:
                try:
                    onset = date(int(year), month, 1)
                except (ValueError, TypeError):
                    pass
            lat = p.get("Latitude")
            lon = p.get("Longitude")
            await conn.execute(
                """
                INSERT INTO substrate.wpv_cases
                    (epid, iso2, adm0_name, adm1_name, adm2_name,
                     adm0_guid, adm1_guid, adm2_guid, classification,
                     wild1, wild2, wild3, vdpv1, vdpv2, vdpv3,
                     onset_year, onset_month, onset_date,
                     latitude, longitude,
                     doses_opv_routine, doses_opv_sia, doses_total,
                     surveillance_type, virus_genotype, virus_cluster,
                     who_region, wild_polio_count, afp_case_count)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
                        $10,$11,$12,$13,$14,$15,
                        $16,$17,$18,$19,$20,
                        $21,$22,$23,$24,$25,$26,$27,$28,$29)
                """,
                p.get("EPID"), p.get("Admin0Iso2"),
                p.get("Admin0Offi"), p.get("Admin1Offi"), p.get("Admin2Offi"),
                p.get("Admin0GUID"), p.get("Admin1GUID"), p.get("Admin2GUID"),
                p.get("Classifica"),
                int(p.get("WILD1") or 0), int(p.get("WILD2") or 0), int(p.get("WILD3") or 0),
                int(p.get("VDPV1") or 0), int(p.get("VDPV2") or 0), int(p.get("VDPV3") or 0),
                int(year) if year else None, month, onset,
                lat, lon,
                int(p.get("DosesOPVRo") or 0), int(p.get("DosesOPVSI") or 0),
                int(p.get("DosesTotal") or 0),
                p.get("Surveillan"), p.get("VirusGenoT"), p.get("VirusClust"),
                p.get("WhoRegion"),
                int(p.get("WildPolioC") or 0), int(p.get("AFPCase_Co") or 0),
            )

        await conn.execute(
            """
            UPDATE substrate.wpv_cases
               SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
             WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            """
        )

    logger.info("gpei wpv_cases ingested count=%d", len(features))
    return len(features)


async def ingest_all(pool: asyncpg.Pool) -> dict:
    districts = await ingest_districts(pool)
    cases = await ingest_wpv_cases(pool)
    return {"districts": districts, "wpv_cases": cases}
