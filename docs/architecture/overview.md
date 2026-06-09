# knightsrook-communicable-disease-forecaster — Architecture Overview

## Purpose

Augmented geospatial risk surface for polio emergence in the Pakistan-Afghanistan endemic bloc. Layers hydrogeological vulnerability, transhumance displacement, fly-mediated exposure kernels, and cross-border corridor analysis over the IDM Bayesian spatial baseline (Mercer et al. 2017).

Produces two separate output surfaces — **transmission risk** and **detection latency** — to distinguish "high risk, well surveilled" from "high risk, blind spot." Date-stamped 6-month predictions committed publicly for prospective validation.

## Services

| Service | Tech | Port | Responsibility |
|---------|------|------|----------------|
| backend | FastAPI (Python 3.12) | 5100 | Data pipelines, layer computation, predictions API |
| dashboard | React + Vite + MapLibre | 5300 | Interactive map — IDM baseline vs. augmented view |
| tileserv | pg_tileserv | 7800 | Vector tile serving from PostGIS |
| db | Postgres 16 (PostGIS + pgvector + AGE) | 5432 | Spatial substrate, layer cache, predictions |

## Data Model

**Schemas:**
- `substrate` — persistent reference data: GADM admin boundaries, HydroSHEDS, WorldPop population grids. Survives `db:reset`.
- `runtime` — ephemeral working state: computed layer outputs, committed predictions. Dropped and recreated by `db:reset`.

**Key tables:**
- `substrate.admin_boundaries` — GADM district polygons (PostGIS geometry)
- `runtime.predictions` — date-stamped committed predictions per district
- `runtime.layer_cache` — computed GeoJSON per layer

## Key Flows

1. **Layer request** — dashboard fetches `/api/layers/{id}` → backend calls subsystem → returns GeoJSON for MapLibre rendering
2. **Tile serving** — dashboard requests vector tiles from pg_tileserv at port 7800 (direct PostGIS connection)
3. **Prediction commit** — `POST /api/predictions` persists a date-stamped prediction; publishes event to WebSocket stream
4. **Live events** — dashboard connects `ws://backend/ws/events` for real-time pipeline status

## Augmentation Layers

| Layer | Sources | Status |
|-------|---------|--------|
| IDM baseline | GPEI public case data | stub |
| Hydrogeology | HydroSHEDS, GRACE/GRACE-FO MASCON | stub |
| Transhumance | FAO baselines, IOM DTM, Sentinel-2 | stub |
| Fly kernel | Breeding-site density + scipy convolution | stub |
| Cross-border | HydroSHEDS terrain + IOM crossing records | stub |
| Surveillance | GPEI campaign coverage by union council | stub |

## Architecture Decision Records

### ADR-001 — Separate transmission-risk and detection-latency surfaces
**Status:** Accepted
**Context:** v1 multiplied the two surfaces together, conflating "the pathogen is here" with "we can't see it here." Decision-makers need to distinguish these.
**Decision:** Compute and visualize as two independent surfaces. Combined intervention priority is their product but must never be the only view.
**Consequences:** Layer infrastructure must support two distinct output types per district.

### ADR-002 — PostGIS as spatial substrate
**Status:** Accepted
**Context:** Admin boundaries, watershed polygons, and encampment geometries are relational-spatial data; a graph DB or flat files would complicate spatial joins.
**Decision:** PostGIS for all geometry. pgvector available for embeddings if ML features are added. AGE available for graph traversal on corridor networks.
**Consequences:** db/Dockerfile compiles AGE from source on top of pgvector:pg16 base + postgis apt install. First build ~3-4 min.

### ADR-003 — Subsystem stubs, independently toggleable
**Status:** Accepted
**Context:** Spec calls for each augmentation layer to be independently falsifiable and toggleable. Build order requires layers to be wired in incrementally.
**Decision:** Each layer is a Python module in `app/subsystems/` implementing `get_layer_data() -> dict`. Stub returns empty feature collection. Dashboard toggles are functional before any layer is implemented.
**Consequences:** Subsystems are sovereign — no shared state. Each is tested independently.
