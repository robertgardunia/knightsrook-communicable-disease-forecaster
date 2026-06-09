-- substrate: persistent reference data (GADM boundaries, HydroSHEDS, WorldPop)
-- runtime:   ephemeral working state (computed layer outputs, committed predictions)
-- db:reset drops only runtime; substrate survives.

CREATE SCHEMA IF NOT EXISTS substrate;
CREATE SCHEMA IF NOT EXISTS runtime;

-- Admin boundaries (GADM) — loaded via ogr2ogr
CREATE TABLE IF NOT EXISTS substrate.admin_boundaries (
    id SERIAL PRIMARY KEY,
    gadm_id TEXT NOT NULL,
    country TEXT NOT NULL,
    level INT NOT NULL,         -- 0=country, 1=province, 2=district
    name TEXT NOT NULL,
    geom GEOMETRY(MULTIPOLYGON, 4326)
);
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_geom ON substrate.admin_boundaries USING GIST(geom);

-- Committed predictions (date-stamped, public)
CREATE TABLE IF NOT EXISTS runtime.predictions (
    id SERIAL PRIMARY KEY,
    committed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    horizon_end DATE NOT NULL,  -- 6-month window end
    layer TEXT NOT NULL,        -- which augmentation layer flagged this
    gadm_id TEXT NOT NULL,
    risk_score FLOAT,
    notes TEXT
);

-- Layer output cache
CREATE TABLE IF NOT EXISTS runtime.layer_cache (
    id SERIAL PRIMARY KEY,
    layer TEXT NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    geojson JSONB
);
