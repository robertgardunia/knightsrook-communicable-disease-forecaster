-- GPEI admin2 district polygons
-- Source: GLOBAL_POLIO_ADM2 FeatureServer (public, no auth)
CREATE TABLE IF NOT EXISTS substrate.gpei_districts (
    id             SERIAL PRIMARY KEY,
    objectid       INT,
    iso2           TEXT NOT NULL,
    adm0_name      TEXT,
    adm1_name      TEXT,
    adm2_name      TEXT,
    adm2_code      TEXT,
    adm1_code      TEXT,
    adm0_code      TEXT,
    who_region     TEXT,
    center_lon     FLOAT,
    center_lat     FLOAT,
    gpei_guid      TEXT,
    adm2_viz_name  TEXT,
    adm1_viz_name  TEXT,
    adm0_viz_name  TEXT,
    ingested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    geom           GEOMETRY(4326)
);
CREATE INDEX IF NOT EXISTS idx_gpei_districts_geom    ON substrate.gpei_districts USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_gpei_districts_iso2    ON substrate.gpei_districts(iso2);
CREATE INDEX IF NOT EXISTS idx_gpei_districts_adm2    ON substrate.gpei_districts(adm2_code);

-- Wild poliovirus individual case records
-- Source: GLOBAL_WPV_CASES FeatureServer (public, no auth)
-- Coordinates represent district-level reporting points, not patient locations.
CREATE TABLE IF NOT EXISTS substrate.wpv_cases (
    id                 SERIAL PRIMARY KEY,
    epid               TEXT,
    iso2               TEXT,
    adm0_name          TEXT,
    adm1_name          TEXT,
    adm2_name          TEXT,
    adm0_guid          TEXT,
    adm1_guid          TEXT,
    adm2_guid          TEXT,
    classification     TEXT,
    wild1              INT  DEFAULT 0,
    wild2              INT  DEFAULT 0,
    wild3              INT  DEFAULT 0,
    vdpv1              INT  DEFAULT 0,
    vdpv2              INT  DEFAULT 0,
    vdpv3              INT  DEFAULT 0,
    onset_year         INT,
    onset_month        INT,
    onset_date         DATE,
    latitude           FLOAT,
    longitude          FLOAT,
    geom               GEOMETRY(Point, 4326),
    doses_opv_routine  INT  DEFAULT 0,
    doses_opv_sia      INT  DEFAULT 0,
    doses_total        INT  DEFAULT 0,
    surveillance_type  TEXT,
    virus_genotype     TEXT,
    virus_cluster      TEXT,
    who_region         TEXT,
    wild_polio_count   INT  DEFAULT 0,
    afp_case_count     INT  DEFAULT 0,
    ingested_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wpv_cases_geom       ON substrate.wpv_cases USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_wpv_cases_iso2       ON substrate.wpv_cases(iso2);
CREATE INDEX IF NOT EXISTS idx_wpv_cases_onset_date ON substrate.wpv_cases(onset_date);

-- GRACE MASCON per-district groundwater anomalies
-- Source: NASA EARTHDATA (free account, EARTHDATA_TOKEN)
-- Resolution: ~0.5° grid aggregated to district centroids.
CREATE TABLE IF NOT EXISTS substrate.grace_groundwater (
    id              SERIAL PRIMARY KEY,
    adm2_code       TEXT NOT NULL,
    month           DATE NOT NULL,
    lwe_anomaly_cm  FLOAT,
    uncertainty_cm  FLOAT,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (adm2_code, month)
);
CREATE INDEX IF NOT EXISTS idx_grace_adm2  ON substrate.grace_groundwater(adm2_code);
CREATE INDEX IF NOT EXISTS idx_grace_month ON substrate.grace_groundwater(month);

-- IOM DTM displacement snapshots
-- Source: HDX (public XLSX downloads, no auth)
CREATE TABLE IF NOT EXISTS substrate.displacement_data (
    id              SERIAL PRIMARY KEY,
    iso2            TEXT NOT NULL,
    adm1_name       TEXT,
    adm2_name       TEXT,
    snapshot_date   DATE,
    idp_individuals INT,
    idp_households  INT,
    source          TEXT,
    raw_data        JSONB,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_displacement_iso2 ON substrate.displacement_data(iso2);
