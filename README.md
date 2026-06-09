# knightsrook-communicable-disease-forecaster

Geospatial epidemiological risk forecaster. Augmented polio emergence prediction: hydrogeology, transhumance displacement, fly-dispersal kernels, and cross-border corridors layered over the IDM Bayesian spatial baseline (Mercer et al. 2017).

Produces two separate output surfaces — transmission risk and detection latency — with date-stamped 6-month predictions committed publicly.

## Stack

- **Backend** — FastAPI (Python 3.12 + uv), asyncpg, xarray, geopandas, scipy
- **Dashboard** — React + Vite + MapLibre GL JS (side-by-side IDM baseline vs. augmented view)
- **Database** — Postgres 16 with PostGIS + pgvector + AGE
- **Tile server** — pg_tileserv (vector tiles from PostGIS)
- **Deploy** — Docker Compose

## Quickstart

```bash
cp .env.example .env   # fill in POSTGRES_USER, POSTGRES_PASS, API_KEY
docker compose up --build
```

- Dashboard: http://localhost:5300
- API: http://localhost:5100/health
- Tiles: http://localhost:7800
- DB build note: first build compiles AGE from source — takes ~3 min

## Architecture

See [docs/architecture/overview.md](docs/architecture/overview.md)

## Data ingestion

Seed the database after first boot:

```bash
curl -X POST http://localhost:5100/ingest/gpei
```

Check status: `GET /ingest/status`

| Source | Table | Auth |
|--------|-------|------|
| GPEI ArcGIS FeatureServer (WPV cases + district polygons) | `substrate.wpv_cases`, `substrate.gpei_districts` | None — public |
| NASA EARTHDATA GRACE MASCON | `substrate.grace_groundwater` | `EARTHDATA_TOKEN` |
| IOM DTM via HDX | `substrate.displacement_data` | None — public |

## Layer status

| Layer | Status |
|-------|--------|
| IDM baseline — recency-weighted WPV case density (exp decay, 6-month half-life) | **live** |
| Hydrogeological vulnerability (HydroSHEDS + GRACE) | stub |
| Transhumance displacement vectors (FAO + IOM DTM) | stub |
| Fly-mediated exposure kernels (convolution) | stub |
| Cross-border transmission corridors | stub |
| Chronic operational misses (campaign coverage) | stub |

## License

MIT — [knightsrook.com](https://knightsrook.com)
