# IDM baseline — recency-weighted WPV case density per district.
# Risk score = Σ exp(-ln2 * days_since_onset / 180) for all wild-type cases,
# normalized 0–1 across all districts. Half-life: 6 months.
# Upgrade path: replace with full INLA Poisson hurdle model (Mercer et al. 2017).

from app.db import get_pool


async def get_layer_data() -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM substrate.wpv_cases")
        if not total:
            return {
                "type": "FeatureCollection",
                "features": [],
                "meta": {"status": "no_data", "hint": "POST /api/ingest/gpei to load case data"},
            }

        rows = await conn.fetch(
            """
            WITH case_scores AS (
                SELECT
                    adm2_name,
                    adm1_name,
                    iso2,
                    SUM(
                        EXP(-0.693147 * GREATEST(0, (CURRENT_DATE - onset_date)::float / 180.0))
                    )                    AS risk_score,
                    COUNT(*)             AS total_cases,
                    MAX(onset_date)      AS last_case_date
                FROM substrate.wpv_cases
                WHERE wild1 = 1
                  AND onset_date IS NOT NULL
                GROUP BY adm2_name, adm1_name, iso2
            ),
            normalizer AS (
                SELECT GREATEST(MAX(risk_score), 1e-10) AS mx FROM case_scores
            )
            SELECT
                cs.adm2_name,
                cs.adm1_name,
                cs.iso2,
                cs.total_cases,
                cs.last_case_date,
                ROUND((cs.risk_score / n.mx)::numeric, 4) AS normalized_score,
                ST_AsGeoJSON(d.geom)::json                AS geometry
            FROM case_scores cs
            CROSS JOIN normalizer n
            LEFT JOIN substrate.gpei_districts d
                   ON d.iso2 = cs.iso2
                  AND LOWER(d.adm2_name) = LOWER(cs.adm2_name)
            WHERE d.geom IS NOT NULL
            ORDER BY normalized_score DESC
            """
        )

    features = [
        {
            "type": "Feature",
            "geometry": row["geometry"],
            "properties": {
                "district": row["adm2_name"],
                "province": row["adm1_name"],
                "country": row["iso2"],
                "risk_score": float(row["normalized_score"]),
                "total_cases": row["total_cases"],
                "last_case": row["last_case_date"].isoformat() if row["last_case_date"] else None,
                "layer": "idm_baseline",
            },
        }
        for row in rows
    ]

    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {
            "total_districts": len(features),
            "scoring": "exp_decay_180d_halflife",
        },
    }
